// Inventory service — concurrency-safe stock operations (ADR-008/010).
// Every mutation is transactional + appended to the immutable inventory_movements audit log.
// NOTE: row-level SELECT ... FOR UPDATE is a PostgreSQL feature; on SQLite the interactive
// transaction's write lock provides equivalent serialization for the sandbox. On VPS/PG the
// transaction runs with the same code path.

import { db } from '@/lib/db';
import type { MovementReason } from '@/lib/constants';
import { notifyBackInStock, notifyWishlistBackInStock } from './stock-alert.service';

export class InventoryError extends Error {
  status: number;
  code: string;
  constructor(message: string, code = 'INVENTORY_ERROR', status = 409) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function availableOf(inv: { currentStock: number; reservedStock: number } | null | undefined): number {
  if (!inv) return 0;
  return Math.max(inv.currentStock - inv.reservedStock, 0);
}

/** Reserve stock for an order (reservedStock += qty). Throws when insufficient. */
export async function reserveStock(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  items: { skuId: string; quantity: number }[],
  referenceId: string
): Promise<void> {
  for (const item of items) {
    const inv = await tx.inventory.findUnique({ where: { skuId: item.skuId } });
    if (!inv) throw new InventoryError(`SKU ${item.skuId} has no inventory record`);
    if (availableOf(inv) < item.quantity) {
      throw new InventoryError(`Insufficient stock for ${item.skuId}. Available: ${availableOf(inv)}, requested: ${item.quantity}`, 'INSUFFICIENT_STOCK');
    }
    await tx.inventory.update({ where: { skuId: item.skuId }, data: { reservedStock: { increment: item.quantity } } });
    await tx.inventoryMovement.create({
      data: { skuId: item.skuId, quantity: -item.quantity, reason: 'ORDER_RESERVED', referenceId, notes: 'Reserved at checkout' },
    });
  }
}

/** Release a reservation (order cancelled / payment failed). */
export async function releaseReservation(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  items: { skuId: string; quantity: number }[],
  referenceId: string
): Promise<void> {
  for (const item of items) {
    const inv = await tx.inventory.findUnique({ where: { skuId: item.skuId } });
    if (!inv) continue;
    const decrement = Math.min(item.quantity, inv.reservedStock);
    await tx.inventory.update({ where: { skuId: item.skuId }, data: { reservedStock: { decrement } } });
    await tx.inventoryMovement.create({
      data: { skuId: item.skuId, quantity: item.quantity, reason: 'ORDER_CANCELLED_RESTOCK', referenceId, notes: 'Reservation released' },
    });
  }
}

/** Physical dispatch: reserved units leave the warehouse (currentStock & reservedStock decrement). */
export async function dispatchStock(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  items: { skuId: string; quantity: number }[],
  referenceId: string
): Promise<void> {
  for (const item of items) {
    const inv = await tx.inventory.findUnique({ where: { skuId: item.skuId } });
    if (!inv) continue;
    const qty = Math.min(item.quantity, inv.reservedStock, inv.currentStock);
    await tx.inventory.update({
      where: { skuId: item.skuId },
      data: { currentStock: { decrement: qty }, reservedStock: { decrement: qty } },
    });
    await tx.inventoryMovement.create({
      data: { skuId: item.skuId, quantity: -qty, reason: 'ORDER_DISPATCHED', referenceId, notes: 'Physical dispatch' },
    });
  }
}

/** Manual/admin adjustment inside a transaction with mandatory reason code (ADR-014). */
export async function adjustStock(params: {
  skuId: string;
  delta: number;
  reason: MovementReason;
  notes?: string;
  createdById?: string;
  referenceId?: string;
}): Promise<{ currentStock: number; reservedStock: number }> {
  return db.$transaction(
    async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { skuId: params.skuId } });
      if (!inv) throw new InventoryError('SKU inventory not found');
      let updated;
      if (params.reason === 'MANUAL_ADJUSTMENT' || params.reason === 'DAMAGED_WRITE_OFF') {
        const next = inv.currentStock + params.delta;
        if (next < 0) throw new InventoryError(`Adjustment would make stock negative (current ${inv.currentStock}, delta ${params.delta})`);
        if (next < inv.reservedStock) {
          throw new InventoryError(`Cannot reduce physical stock below reserved units (${inv.reservedStock} reserved)`);
        }
        updated = await tx.inventory.update({ where: { skuId: params.skuId }, data: { currentStock: next } });
      } else {
        // positive intake reasons (PURCHASE_RECEIPT / RETURN_RESTOCK)
        const next = inv.currentStock + params.delta;
        if (next < 0) throw new InventoryError('Adjustment would make stock negative');
        updated = await tx.inventory.update({ where: { skuId: params.skuId }, data: { currentStock: next } });
      }
      await tx.inventoryMovement.create({
        data: {
          skuId: params.skuId,
          quantity: params.delta,
          reason: params.reason,
          notes: params.notes,
          createdById: params.createdById,
          referenceId: params.referenceId,
        },
      });

      // product-level OOS → available transition for wishlist notifications.
      // Only this SKU changed inside the tx (by delta on currentStock), so the
      // product total BEFORE the write is (totalAfter − delta) — exact, no re-read races.
      let wishlistTransition = false;
      if (params.delta > 0) {
        const sku = await tx.sku.findUnique({
          where: { id: params.skuId },
          select: { variant: { select: { productId: true } } },
        });
        const productId = sku?.variant?.productId;
        if (productId) {
          const siblings = await tx.inventory.findMany({
            where: { sku: { variant: { productId } } },
            select: { currentStock: true, reservedStock: true },
          });
          const totalAfter = siblings.reduce((n, s) => n + (s.currentStock - s.reservedStock), 0);
          const totalBefore = totalAfter - params.delta;
          wishlistTransition = totalBefore <= 0 && totalAfter > 0;
          return {
            currentStock: updated.currentStock,
            reservedStock: updated.reservedStock,
            skuId: params.skuId,
            productId,
            wishlistTransition,
          };
        }
      }
      return {
        currentStock: updated.currentStock,
        reservedStock: updated.reservedStock,
        skuId: params.skuId,
        productId: null as string | null,
        wishlistTransition: false,
      };
    },
    { maxWait: 15000, timeout: 30000 }
  ).then((result) => {
    // post-commit: fire back-in-stock notifications when availability recovers
    if (result.skuId && params.delta > 0) void notifyBackInStock(result.skuId);
    if (result.wishlistTransition && result.productId) void notifyWishlistBackInStock(result.productId);
    return { currentStock: result.currentStock, reservedStock: result.reservedStock };
  });
}

export async function getStockHistory(skuId: string, take = 50) {
  return db.inventoryMovement.findMany({
    where: { skuId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}
