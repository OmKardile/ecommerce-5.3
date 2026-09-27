// Stock Monitor service (ADR-010) — the employee observe-and-report layer.
// Reads Inventory/InventoryMovement for projections; approvals and variance
// applications write through the SAME audited movement ledger as the
// inventory console (never a parallel ledger).

import { db } from '@/lib/db';
import { recordAudit } from '@/server/services/notification.service';

export class StockMonitorError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

// ---------- wall projection ----------

export interface WallSku {
  skuId: string;
  code: string;
  barcode: string | null;
  available: number;
  currentStock: number;
  reservedStock: number;
  lowStockThreshold: number;
  state: 'OK' | 'LOW' | 'OUT';
}

export interface WallTile {
  productId: string;
  name: string;
  slug: string;
  modelNumber: string | null;
  brandName: string;
  categoryName: string;
  image: string | null;
  skus: WallSku[];
  worst: 'OK' | 'LOW' | 'OUT';
}

const MOVEMENT_PHRASES: Record<string, (qty: number, ref: string | null) => string> = {
  PURCHASE_RECEIPT: (q) => `${q > 0 ? '+' : ''}${q} received into stock`,
  ORDER_RESERVED: (q, ref) => `${q} reserved for order ${shortRef(ref)}`,
  ORDER_DISPATCHED: (q, ref) => `${Math.abs(q)} dispatched${ref ? ` · ${shortRef(ref)}` : ''}`,
  ORDER_CANCELLED_RESTOCK: (q, ref) => `+${Math.abs(q)} restocked (order cancelled${ref ? ` · ${shortRef(ref)}` : ''})`,
  RETURN_RESTOCK: (q) => `+${Math.abs(q)} restocked (customer return)`,
  MANUAL_ADJUSTMENT: (q) => `${q > 0 ? '+' : ''}${q} manual adjustment`,
  DAMAGED_WRITE_OFF: (q) => `${Math.abs(q)} written off (damaged)`,
};

function shortRef(ref: string | null): string {
  return ref ? (ref.length > 12 ? `${ref.slice(0, 12)}…` : ref) : '—';
}

function deriveState(available: number, threshold: number): 'OK' | 'LOW' | 'OUT' {
  if (available <= 0) return 'OUT';
  if (available <= threshold) return 'LOW';
  return 'OK';
}

export async function getWallProjection(filters: { q?: string; categoryId?: string; brandId?: string }): Promise<{ tiles: WallTile[]; totals: { ok: number; low: number; out: number; skus: number } }> {
  const products = await db.product.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      modelNumber: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
      variants: {
        select: {
          sku: {
            select: {
              id: true,
              code: true,
              barcode: true,
              isActive: true,
              inventory: { select: { currentStock: true, reservedStock: true, lowStockThreshold: true } },
            },
          },
        },
      },
    },
  });

  const q = filters.q?.trim().toLowerCase();
  const tiles: WallTile[] = [];
  const totals = { ok: 0, low: 0, out: 0, skus: 0 };

  for (const p of products) {
    const skus: WallSku[] = p.variants
      .map((v) => v.sku)
      .filter((s) => s.isActive && s.inventory)
      .map((s) => {
        const inv = s.inventory!;
        const available = inv.currentStock - inv.reservedStock;
        return {
          skuId: s.id,
          code: s.code,
          barcode: s.barcode,
          available,
          currentStock: inv.currentStock,
          reservedStock: inv.reservedStock,
          lowStockThreshold: inv.lowStockThreshold,
          state: deriveState(available, inv.lowStockThreshold),
        };
      });
    if (skus.length === 0) continue;

    if (q) {
      const haystack = [p.name, p.modelNumber ?? '', p.brand.name, ...skus.flatMap((s) => [s.code, s.barcode ?? ''])]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) continue;
    }

    const worst = skus.some((s) => s.state === 'OUT') ? 'OUT' : skus.some((s) => s.state === 'LOW') ? 'LOW' : 'OK';
    for (const s of skus) {
      totals.skus += 1;
      if (s.state === 'OK') totals.ok += 1;
      else if (s.state === 'LOW') totals.low += 1;
      else totals.out += 1;
    }
    tiles.push({
      productId: p.id,
      name: p.name,
      slug: p.slug,
      modelNumber: p.modelNumber,
      brandName: p.brand.name,
      categoryName: p.category.name,
      image: p.images[0]?.url ?? null,
      skus,
      worst,
    });
  }

  return { tiles, totals };
}

// ---------- movement history (human phrased) ----------

export async function getSkuHistory(skuId: string, take = 30) {
  const sku = await db.sku.findUnique({
    where: { id: skuId },
    select: { id: true, code: true, barcode: true, inventory: { select: { currentStock: true, reservedStock: true, lowStockThreshold: true } } },
  });
  if (!sku) throw new StockMonitorError('SKU not found', 404);

  const movements = await db.inventoryMovement.findMany({
    where: { skuId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, quantity: true, reason: true, referenceId: true, notes: true, createdAt: true },
  });

  return {
    sku: { id: sku.id, code: sku.code, barcode: sku.barcode, currentStock: sku.inventory?.currentStock ?? 0, reservedStock: sku.inventory?.reservedStock ?? 0 },
    movements: movements.map((m) => ({
      id: m.id,
      quantity: m.quantity,
      reason: m.reason,
      referenceId: m.referenceId,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
      phrase: (MOVEMENT_PHRASES[m.reason] ?? ((q: number) => `${q > 0 ? '+' : ''}${q} (${m.reason.toLowerCase().replace(/_/g, ' ')})`))(m.quantity, m.referenceId),
    })),
  };
}

// ---------- count sessions ----------

export async function openCountSession(params: { title: string; scopeKind: 'CATEGORY' | 'BRAND' | 'ALL'; scopeRefId?: string; openedById: string }) {
  const scopeFilter =
    params.scopeKind === 'CATEGORY'
      ? { category: { id: params.scopeRefId } }
      : params.scopeKind === 'BRAND'
        ? { brand: { id: params.scopeRefId } }
        : {};

  const skus = await db.sku.findMany({
    where: { isActive: true, inventory: { isNot: null }, variant: { product: { deletedAt: null, isActive: true, ...scopeFilter } } },
    select: { id: true, code: true, inventory: { select: { currentStock: true } } },
    orderBy: { code: 'asc' },
  });
  if (skus.length === 0) throw new StockMonitorError('The selected scope has no countable SKUs');
  if (skus.length > 500) throw new StockMonitorError(`Scope too large (${skus.length} SKUs) — narrow to a category or brand`);

  const session = await db.stockCountSession.create({
    data: {
      title: params.title,
      scopeKind: params.scopeKind,
      scopeRefId: params.scopeRefId,
      openedById: params.openedById,
      expected: skus.map((s) => ({ skuId: s.id, code: s.code, expectedQty: s.inventory?.currentStock ?? 0 })),
      lines: {
        create: skus.map((s) => ({ skuId: s.id, expectedQty: s.inventory?.currentStock ?? 0 })),
      },
    },
  });

  await recordAudit('STOCK_COUNT_OPENED', 'STOCK_COUNT_SESSION', session.id, { title: params.title, scopeKind: params.scopeKind, scopeRefId: params.scopeRefId ?? null, skus: skus.length }, params.openedById);
  return session;
}

export async function submitCountLines(sessionId: string, lines: { lineId: string; countedQty: number; note?: string }[], userId: string) {
  const session = await db.stockCountSession.findUnique({ where: { id: sessionId }, include: { lines: true } });
  if (!session) throw new StockMonitorError('Count session not found', 404);
  if (!['OPEN', 'COUNTING'].includes(session.status)) throw new StockMonitorError(`Session is ${session.status} — no further counting`);

  const lineIds = new Set(session.lines.map((l) => l.id));
  for (const l of lines) {
    if (!lineIds.has(l.lineId)) throw new StockMonitorError('Counted line does not belong to this session');
  }

  const expectedById = new Map(session.lines.map((l) => [l.id, l.expectedQty]));
  await db.$transaction(async (tx) => {
    for (const l of lines) {
      await tx.stockCountLine.update({
        where: { id: l.lineId },
        data: { countedQty: l.countedQty, variance: l.countedQty - (expectedById.get(l.lineId) ?? 0), countedById: userId, countedAt: new Date(), note: l.note ?? null },
      });
    }
    const after = await tx.stockCountSession.findUnique({ where: { id: sessionId }, include: { lines: true } });
    const allCounted = after?.lines.every((l) => l.countedQty !== null) ?? false;
    await tx.stockCountSession.update({ where: { id: sessionId }, data: { status: allCounted ? 'SUBMITTED' : 'COUNTING' } });
  });

  const mismatch = lines.filter((l) => l.countedQty !== (expectedById.get(l.lineId) ?? 0)).length;
  await recordAudit('STOCK_COUNT_SUBMITTED', 'STOCK_COUNT_SESSION', sessionId, { lines: lines.length, mismatches: mismatch }, userId);
  return { submitted: lines.length, mismatches: mismatch };
}

export async function listCountSessions() {
  const sessions = await db.stockCountSession.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      openedByIdx: { select: { fullName: true, email: true } },
      lines: { select: { id: true, variance: true, countedQty: true, appliedAt: true } },
    },
  });
  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    scopeKind: s.scopeKind,
    openedBy: s.openedByIdx?.fullName || s.openedByIdx?.email || '—',
    createdAt: s.createdAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
    totalLines: s.lines.length,
    countedLines: s.lines.filter((l) => l.countedQty !== null).length,
    varianceLines: s.lines.filter((l) => l.variance !== null && l.variance !== 0).length,
    unappliedVariances: s.lines.filter((l) => l.variance !== null && l.variance !== 0 && !l.appliedAt).length,
  }));
}

export async function getCountSessionDetail(sessionId: string) {
  const session = await db.stockCountSession.findUnique({
    where: { id: sessionId },
    include: {
      openedByIdx: { select: { fullName: true, email: true } },
      lines: {
        orderBy: { id: 'asc' },
        include: { sku: { select: { code: true, variant: { select: { name: true, product: { select: { name: true } } } } } } },
      },
    },
  });
  if (!session) throw new StockMonitorError('Count session not found', 404);
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    scopeKind: session.scopeKind,
    openedBy: session.openedByIdx?.fullName || session.openedByIdx?.email || '—',
    createdAt: session.createdAt.toISOString(),
    lines: session.lines.map((l) => ({
      id: l.id,
      skuCode: l.sku.code,
      productName: l.sku.variant?.product.name ?? '—',
      variantName: l.sku.variant?.name ?? null,
      expectedQty: l.expectedQty,
      countedQty: l.countedQty,
      variance: l.variance,
      note: l.note,
      appliedAt: l.appliedAt?.toISOString() ?? null,
    })),
  };
}

export async function applyCountLine(lineId: string, deciderId: string) {
  const line = await db.stockCountLine.findUnique({ where: { id: lineId }, include: { session: true, sku: { include: { inventory: true } } } });
  if (!line) throw new StockMonitorError('Count line not found', 404);
  if (!['SUBMITTED', 'COUNTING', 'CLOSED'].includes(line.session.status)) throw new StockMonitorError('Session not submitted yet');
  if (line.countedQty === null) throw new StockMonitorError('Line has no counted quantity');
  if (line.variance === null || line.variance === 0) throw new StockMonitorError('Line has no variance to apply');
  if (line.appliedAt) throw new StockMonitorError('Variance already applied');
  const inv = line.sku.inventory;
  if (!inv) throw new StockMonitorError('SKU has no inventory record');

  const delta: number = line.variance;
  const result = await db.$transaction(async (tx) => {
    const next = inv.currentStock + delta;
    if (next < 0) throw new StockMonitorError(`Adjustment would make stock negative (current ${inv.currentStock})`);
    if (next < inv.reservedStock) throw new StockMonitorError(`Cannot reduce below reserved units (${inv.reservedStock} reserved)`);
    await tx.inventory.update({ where: { skuId: line.skuId }, data: { currentStock: next } });
    const movement = await tx.inventoryMovement.create({
      data: { skuId: line.skuId, quantity: delta, reason: 'MANUAL_ADJUSTMENT', referenceId: line.sessionId, notes: `Count session "${line.session.title}" variance`, createdById: deciderId },
    });
    await tx.stockCountLine.update({ where: { id: lineId }, data: { appliedAt: new Date(), appliedMovementId: movement.id } });
    return { currentStock: next };
  });

  await recordAudit('STOCK_COUNT_VARIANCE_APPLIED', 'STOCK_COUNT_LINE', lineId, { skuId: line.skuId, delta, sessionId: line.sessionId, result }, deciderId);
  return result;
}

export async function closeCountSession(sessionId: string, deciderId: string) {
  const session = await db.stockCountSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new StockMonitorError('Count session not found', 404);
  if (!['SUBMITTED', 'COUNTING', 'OPEN'].includes(session.status)) throw new StockMonitorError(`Session already ${session.status}`);
  await db.stockCountSession.update({ where: { id: sessionId }, data: { status: 'CLOSED', closedById: deciderId, closedAt: new Date() } });
  await recordAudit('STOCK_COUNT_CLOSED', 'STOCK_COUNT_SESSION', sessionId, {}, deciderId);
  return { closed: true };
}

// ---------- adjustment requests (propose → decide) ----------

export async function proposeAdjustment(params: { skuId: string; delta: number; reason: string; note?: string; requestedById: string }) {
  const sku = await db.sku.findUnique({ where: { id: params.skuId }, select: { id: true, code: true } });
  if (!sku) throw new StockMonitorError('SKU not found', 404);

  const request = await db.stockAdjustmentRequest.create({
    data: { skuId: params.skuId, delta: params.delta, reason: params.reason, note: params.note, requestedById: params.requestedById },
  });
  await recordAudit('STOCK_REQUEST_PROPOSED', 'STOCK_ADJUSTMENT_REQUEST', request.id, { skuId: params.skuId, skuCode: sku.code, delta: params.delta, reason: params.reason, note: params.note ?? null }, params.requestedById);
  return request;
}

export async function listAdjustmentRequests(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
  const requests = await db.stockAdjustmentRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: {
      sku: { select: { code: true, variant: { select: { name: true, product: { select: { name: true } } } } } },
    },
  });
  return requests.map((r) => ({
    id: r.id,
    skuId: r.skuId,
    skuCode: r.sku.code,
    productName: r.sku.variant?.product.name ?? '—',
    variantName: r.sku.variant?.name ?? null,
    delta: r.delta,
    reason: r.reason,
    note: r.note,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
  }));
}

export async function decideAdjustment(requestId: string, decision: 'APPROVED' | 'REJECTED', deciderId: string) {
  const request = await db.stockAdjustmentRequest.findUnique({ where: { id: requestId }, include: { sku: { include: { inventory: true } } } });
  if (!request) throw new StockMonitorError('Request not found', 404);
  if (request.status !== 'PENDING') throw new StockMonitorError(`Request already ${request.status}`);

  let movementId: string | null = null;
  if (decision === 'APPROVED' && request.delta !== 0) {
    const inv = request.sku.inventory;
    if (!inv) throw new StockMonitorError('SKU has no inventory record');
    const result = await db.$transaction(async (tx) => {
      const next = inv.currentStock + request.delta;
      if (next < 0) throw new StockMonitorError(`Approval would make stock negative (current ${inv.currentStock})`);
      if (next < inv.reservedStock) throw new StockMonitorError(`Cannot reduce below reserved units (${inv.reservedStock} reserved)`);
      await tx.inventory.update({ where: { skuId: request.skuId }, data: { currentStock: next } });
      const movement = await tx.inventoryMovement.create({
        data: { skuId: request.skuId, quantity: request.delta, reason: 'MANUAL_ADJUSTMENT', referenceId: requestId, notes: `Approved stock-monitor request (${request.reason})`, createdById: deciderId },
      });
      await tx.stockAdjustmentRequest.update({ where: { id: requestId }, data: { status: 'APPROVED', decidedById: deciderId, decidedAt: new Date(), movementId: movement.id } });
      return { currentStock: next, movementId: movement.id };
    });
    movementId = result.movementId;
  } else {
    await db.stockAdjustmentRequest.update({
      where: { id: requestId },
      data: { status: decision, decidedById: deciderId, decidedAt: new Date() },
    });
  }

  await recordAudit(decision === 'APPROVED' ? 'STOCK_REQUEST_APPROVED' : 'STOCK_REQUEST_REJECTED', 'STOCK_ADJUSTMENT_REQUEST', requestId, { delta: request.delta, reason: request.reason, movementId }, deciderId);
  return { status: decision, movementId };
}
