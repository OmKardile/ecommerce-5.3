// Stock alerts — "notify me when back in stock" (customer capture) and the
// dispatch hook that fires notifications when a SKU's availability recovers.

import { db } from '@/lib/db';
import { sendWhatsAppTemplate } from './notification.service';

export class StockAlertError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function createStockAlert(skuId: string, phone: string): Promise<{ ok: boolean; alreadyInStock?: boolean }> {
  const sku = await db.sku.findUnique({
    where: { id: skuId },
    include: { inventory: true, variant: { include: { product: { select: { isActive: true, deletedAt: true } } } } },
  });
  if (!sku || !sku.variant || !sku.variant.product.isActive || sku.variant.product.deletedAt) {
    throw new StockAlertError('Product unavailable', 404);
  }
  const available = sku.inventory ? sku.inventory.currentStock - sku.inventory.reservedStock : 0;
  if (available > 0) return { ok: false, alreadyInStock: true };

  await db.stockAlert.upsert({
    where: { skuId_phone: { skuId, phone } },
    update: { status: 'PENDING', notifiedAt: null },
    create: { skuId, phone, status: 'PENDING' },
  });
  return { ok: true };
}

/**
 * Fire-and-forget dispatcher — call after a POSITIVE intake (purchase receipt /
 * return restock) on a SKU. Only notifies when availability actually crossed
 * from 0 (or below) to positive, and marks alerts NOTIFIED.
 */
export async function notifyBackInStock(skuId: string): Promise<number> {
  try {
    const inv = await db.inventory.findUnique({ where: { skuId } });
    const available = inv ? inv.currentStock - inv.reservedStock : 0;
    if (available <= 0) return 0;

    const alerts = await db.stockAlert.findMany({ where: { skuId, status: 'PENDING' } });
    if (!alerts.length) return 0;

    const sku = await db.sku.findUnique({
      where: { id: skuId },
      include: { variant: { include: { product: { select: { name: true } } } } },
    });
    const productName = sku?.variant?.product.name ?? 'A product';
    const skuCode = sku?.code ?? '';

    for (const alert of alerts) {
      void sendWhatsAppTemplate(alert.phone, 'back_in_stock', [productName, skuCode]);
      await db.stockAlert.update({
        where: { id: alert.id },
        data: { status: 'NOTIFIED', notifiedAt: new Date() },
      });
    }
    return alerts.length;
  } catch (err) {
    // never let alert dispatch break an inventory write
    console.error('[stock-alert] dispatch failed:', err);
    return 0;
  }
}

/**
 * Product-level back-in-stock for WISHLIST savers. StockAlert is SKU-scoped and
 * requires an explicit opt-in on an out-of-stock variant; the wishlist is
 * product-scoped implicit intent, so this dispatcher is only called on the
 * product-level 0 → positive availability transition (see inventory.service
 * adjustStock post-commit) — not on every top-up — to avoid spamming savers
 * every time a partially-stocked product receives more units.
 */
export async function notifyWishlistBackInStock(productId: string): Promise<number> {
  try {
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { name: true, isActive: true, deletedAt: true },
    });
    if (!product || !product.isActive || product.deletedAt) return 0;

    // wishlist → owner → user (phone is the identity on this platform)
    const items = await db.wishlistItem.findMany({
      where: { productId },
      select: {
        wishlist: {
          select: { user: { select: { phone: true, isActive: true, deletedAt: true } } },
        },
      },
    });

    const phones = new Set<string>();
    for (const item of items) {
      const user = item.wishlist.user;
      if (user && user.phone && user.isActive && !user.deletedAt) phones.add(user.phone);
    }
    if (!phones.size) return 0;

    for (const phone of phones) {
      void sendWhatsAppTemplate(phone, 'back_in_stock', [product.name, 'Back in stock — order now']);
    }
    return phones.size;
  } catch (err) {
    // never let wishlist dispatch break an inventory write
    console.error('[stock-alert] wishlist dispatch failed:', err);
    return 0;
  }
}
