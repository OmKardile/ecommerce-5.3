// Admin analytics & commercial reporting (ADR-014 / ADR-017).
// All aggregations server-side; money in paise.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export interface DashboardMetrics {
  gmvPaise: number;
  gstCollectedPaise: number;
  totalOrders: number;
  pendingOrders: number;
  codPendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  prepaidValuePaise: number;
  codValuePaise: number;
  customers: number;
  products: number;
  lowStock: { skuCode: string; productName: string; variantName: string; available: number; threshold: number }[];
  outOfStock: number;
  todaySalesPaise: number;
  monthSalesPaise: number;
  dailySales: { date: string; orders: number; valuePaise: number }[];
  // after-sales & promotions visibility
  openReturns: number;
  pendingStockAlerts: number;
  openInquiries: number;
  couponRedemptions30d: number;
  couponDiscount30dPaise: number;
}

const PAID_STATUSES = ['PAID', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [ordersAgg, statusGroups, customers, products, lowStockInv, outOfStock, todayAgg, monthAgg, recentPaid] = await Promise.all([
    db.order.aggregate({ where: { status: { in: PAID_STATUSES } }, _sum: { totalAmount: true, gstAmount: true }, _count: { _all: true } }),
    db.order.groupBy({ by: ['status'], _count: { _all: true }, _sum: { totalAmount: true } }),
    db.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
    db.product.count({ where: { deletedAt: null } }),
    db.inventory.findMany({
      where: {},
      include: { sku: { include: { variant: { include: { product: { select: { name: true } } } } } } },
    }),
    db.inventory.count({ where: { currentStock: 0 } }),
    db.order.aggregate({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, status: { in: PAID_STATUSES } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    db.order.aggregate({
      where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }, status: { in: PAID_STATUSES } },
      _sum: { totalAmount: true },
    }),
    db.order.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) }, status: { in: PAID_STATUSES } },
      select: { createdAt: true, totalAmount: true },
    }),
  ]);

  const statusCount = (s: string) => statusGroups.find((g) => g.status === s)?._count._all ?? 0;
  const statusSum = (s: string) => statusGroups.find((g) => g.status === s)?._sum.totalAmount ?? 0;

  // after-sales & promotions snapshot (kept additive — separate round-trip, same tick)
  const since30d = new Date(Date.now() - 30 * 86400000);
  const [openReturns, pendingStockAlerts, couponAgg30d, openInquiries] = await Promise.all([
    db.orderReturn.count({ where: { status: { in: ['REQUESTED', 'APPROVED'] } } }),
    db.stockAlert.count({ where: { status: 'PENDING' } }),
    db.couponRedemption.aggregate({ where: { createdAt: { gte: since30d } }, _count: { _all: true }, _sum: { discountAmount: true } }),
    db.b2BInquiry.count({ where: { status: 'NEW' } }),
  ]);

  const lowStock = lowStockInv
    .filter((inv) => inv.currentStock - inv.reservedStock <= inv.lowStockThreshold && inv.currentStock > 0)
    .slice(0, 12)
    .map((inv) => ({
      skuCode: inv.sku.code,
      productName: inv.sku.variant?.product.name ?? '—',
      variantName: inv.sku.variant?.name ?? '—',
      available: inv.currentStock - inv.reservedStock,
      threshold: inv.lowStockThreshold,
    }));

  // 30-day daily series
  const dailyMap = new Map<string, { orders: number; valuePaise: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dailyMap.set(d.toISOString().slice(0, 10), { orders: 0, valuePaise: 0 });
  }
  for (const o of recentPaid) {
    const key = o.createdAt.toISOString().slice(0, 10);
    const bucket = dailyMap.get(key);
    if (bucket) {
      bucket.orders += 1;
      bucket.valuePaise += o.totalAmount;
    }
  }

  return {
    gmvPaise: ordersAgg._sum.totalAmount ?? 0,
    gstCollectedPaise: ordersAgg._sum.gstAmount ?? 0,
    totalOrders: ordersAgg._count._all,
    pendingOrders: statusCount('PENDING_PAYMENT') + statusCount('COD_PENDING'),
    codPendingOrders: statusCount('COD_PENDING'),
    processingOrders: statusCount('CONFIRMED') + statusCount('PROCESSING') + statusCount('PACKED'),
    shippedOrders: statusCount('SHIPPED') + statusCount('OUT_FOR_DELIVERY'),
    deliveredOrders: statusCount('DELIVERED'),
    cancelledOrders: statusCount('CANCELLED'),
    prepaidValuePaise: statusSum('PAID') + statusSum('CONFIRMED') + statusSum('PROCESSING') + statusSum('PACKED') + statusSum('SHIPPED') + statusSum('OUT_FOR_DELIVERY') + statusSum('DELIVERED'),
    codValuePaise: 0,
    customers,
    products,
    lowStock,
    outOfStock,
    todaySalesPaise: todayAgg._sum.totalAmount ?? 0,
    monthSalesPaise: monthAgg._sum.totalAmount ?? 0,
    dailySales: [...dailyMap.entries()].map(([date, v]) => ({ date, ...v })),
    openReturns,
    pendingStockAlerts,
    openInquiries,
    couponRedemptions30d: couponAgg30d._count._all,
    couponDiscount30dPaise: couponAgg30d._sum.discountAmount ?? 0,
  };
}

export async function getAdminOrdersList(params: { q?: string; status?: string; page?: number; perPage?: number }) {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const where: Prisma.OrderWhereInput = {};
  if (params.status && params.status !== 'ALL') where.status = params.status;
  if (params.q) {
    const q = params.q.trim();
    where.OR = [
      { orderNumber: { contains: q } },
      { deliveryName: { contains: q } },
      { deliveryPhone: { contains: q } },
      { deliveryCity: { contains: q } },
      { shipments: { some: { awb: { contains: q } } } },
    ];
  }
  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        items: true,
        payments: true,
        shipments: true,
        user: { select: { phone: true, fullName: true, customer: { select: { isB2BVerified: true, gstin: true } } } },
      },
    }),
  ]);
  return { total, orders, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export interface AdminCustomerRow {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  companyName: string | null;
  gstin: string | null;
  isB2BVerified: boolean;
  orderCount: number;
  lifetimeValuePaise: number;
  city: string | null;
  createdAt: Date;
}

export async function getAdminCustomers(params: { q?: string; filter?: 'ALL' | 'B2B' | 'RETAIL'; page?: number; perPage?: number }) {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const where: Prisma.UserWhereInput = { role: 'CUSTOMER', deletedAt: null };
  if (params.q) {
    where.OR = [
      { phone: { contains: params.q } },
      { fullName: { contains: params.q } },
      { customer: { is: { companyName: { contains: params.q } } } },
      { customer: { is: { gstin: { contains: params.q } } } },
    ];
  }
  if (params.filter === 'B2B') where.customer = { is: { gstin: { not: null } } };
  if (params.filter === 'RETAIL') where.customer = { is: { gstin: null } };

  const users = await db.user.findMany({
    where,
    include: { customer: { include: { addresses: { take: 1, orderBy: { isDefault: 'desc' } } } } },
    skip: (page - 1) * perPage,
    take: perPage,
    orderBy: { createdAt: 'desc' },
  });

  const ids = users.map((u) => u.id);
  const orderAgg = await db.order.groupBy({
    by: ['userId'],
    where: { userId: { in: ids }, status: { in: PAID_STATUSES } },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });
  const aggMap = new Map(orderAgg.map((a) => [a.userId, a]));

  const rows: AdminCustomerRow[] = users.map((u) => ({
    id: u.customer?.id ?? u.id,
    userId: u.id,
    fullName: u.customer?.fullName ?? u.fullName ?? '—',
    phone: u.phone,
    companyName: u.customer?.companyName ?? null,
    gstin: u.customer?.gstin ?? null,
    isB2BVerified: u.customer?.isB2BVerified ?? false,
    orderCount: aggMap.get(u.id)?._count._all ?? 0,
    lifetimeValuePaise: aggMap.get(u.id)?._sum.totalAmount ?? 0,
    city: u.customer?.addresses[0]?.city ?? null,
    createdAt: u.createdAt,
  }));
  const total = await db.user.count({ where });
  return { rows, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export interface CommercialReports {
  gmvPaise: number;
  ordersCount: number;
  aovPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxableBasePaise: number;
  prepaidOrders: number;
  codOrders: number;
  prepaidValuePaise: number;
  codValuePaise: number;
  inventoryUnits: number;
  inventoryAvailable: number;
  inventoryValuePaise: number;
  topProducts: { name: string; unitsSold: number; revenuePaise: number }[];
  topCustomers: { name: string; phone: string; orders: number; valuePaise: number }[];
  dailySales: { date: string; orders: number; valuePaise: number }[];
}

export async function getCommercialReports(days = 30): Promise<CommercialReports> {
  // Period window: KPIs, top lists and the daily series all respect it;
  // inventory valuation stays a live snapshot (not period-bound).
  const windowDays = Number.isFinite(days) && [7, 30, 90, 180].includes(days) ? days : 30;
  const since = new Date(Date.now() - windowDays * 86400000);
  const paidWhere: Prisma.OrderWhereInput = { status: { in: PAID_STATUSES }, createdAt: { gte: since } };
  const [agg, paySplit, invAgg, itemAgg, custAgg, recentPaid] = await Promise.all([
    db.order.aggregate({
      where: paidWhere,
      _sum: { totalAmount: true, gstAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, subtotal: true },
      _count: { _all: true },
    }),
    db.order.groupBy({ by: ['paymentMethod'], where: paidWhere, _count: { _all: true }, _sum: { totalAmount: true } }),
    db.inventory.aggregate({ _sum: { currentStock: true }, _count: { _all: true } }),
    db.orderItem.groupBy({
      by: ['productName'],
      where: { order: paidWhere },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 8,
    }),
    db.order.groupBy({ by: ['userId'], where: paidWhere, _count: { _all: true }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: 'desc' } }, take: 8 }),
    db.order.findMany({ where: { ...paidWhere }, select: { createdAt: true, totalAmount: true } }),
  ]);

  // inventory capital value = sum(sellingPrice * currentStock) across SKUs
  const invRows = await db.inventory.findMany({ include: { sku: { select: { sellingPrice: true } } } });
  const inventoryValuePaise = invRows.reduce((n, r) => n + r.sku.sellingPrice * r.currentStock, 0);
  const inventoryAvailable = invRows.reduce((n, r) => n + Math.max(r.currentStock - r.reservedStock, 0), 0);

  const userIds = custAgg.map((c) => c.userId);
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, phone: true } });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const dailyMap = new Map<string, { orders: number; valuePaise: number }>();
  for (let i = windowDays - 1; i >= 0; i--) {
    dailyMap.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), { orders: 0, valuePaise: 0 });
  }
  for (const o of recentPaid) {
    const b = dailyMap.get(o.createdAt.toISOString().slice(0, 10));
    if (b) {
      b.orders += 1;
      b.valuePaise += o.totalAmount;
    }
  }

  const ordersCount = agg._count._all;
  return {
    gmvPaise: agg._sum.totalAmount ?? 0,
    ordersCount,
    aovPaise: ordersCount ? Math.round((agg._sum.totalAmount ?? 0) / ordersCount) : 0,
    cgstPaise: agg._sum.cgstAmount ?? 0,
    sgstPaise: agg._sum.sgstAmount ?? 0,
    igstPaise: agg._sum.igstAmount ?? 0,
    taxableBasePaise: agg._sum.subtotal ?? 0,
    prepaidOrders: paySplit.find((p) => p.paymentMethod === 'RAZORPAY')?._count._all ?? 0,
    codOrders: paySplit.find((p) => p.paymentMethod === 'COD')?._count._all ?? 0,
    prepaidValuePaise: paySplit.find((p) => p.paymentMethod === 'RAZORPAY')?._sum.totalAmount ?? 0,
    codValuePaise: paySplit.find((p) => p.paymentMethod === 'COD')?._sum.totalAmount ?? 0,
    inventoryUnits: invAgg._sum.currentStock ?? 0,
    inventoryAvailable,
    inventoryValuePaise,
    topProducts: itemAgg.map((i) => ({ name: i.productName, unitsSold: i._sum.quantity ?? 0, revenuePaise: i._sum.totalPrice ?? 0 })),
    topCustomers: custAgg.map((c) => ({
      name: userMap.get(c.userId)?.fullName ?? '—',
      phone: userMap.get(c.userId)?.phone ?? '—',
      orders: c._count._all,
      valuePaise: c._sum.totalAmount ?? 0,
    })),
    dailySales: [...dailyMap.entries()].map(([date, v]) => ({ date, ...v })),
  };
}

export interface CouponAnalyticsRow {
  id: string;
  code: string;
  type: string;
  value: number;
  isActive: boolean;
  usageLimit: number | null;
  usedCount: number;
  redemptionCount: number;
  discountGivenPaise: number;
  lastUsedAt: Date | null;
}

/** Per-coupon usage: real redemption rows (not just the counter), total discount given, last use. */
export async function getCouponAnalytics(): Promise<CouponAnalyticsRow[]> {
  const coupons = await db.coupon.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }], include: { redemptions: { select: { discountAmount: true, createdAt: true } } } });
  return coupons.map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    value: c.value,
    isActive: c.isActive,
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    redemptionCount: c.redemptions.length,
    discountGivenPaise: c.redemptions.reduce((n, r) => n + r.discountAmount, 0),
    lastUsedAt: c.redemptions.reduce<Date | null>((latest, r) => (!latest || r.createdAt > latest ? r.createdAt : latest), null),
  }));
}

/** GSTR-1 style tax schedule rows (ADR-017). */
export async function getGstr1Schedule(from: Date, to: Date) {
  const orders = await db.order.findMany({
    where: { status: { in: PAID_STATUSES }, createdAt: { gte: from, lte: to } },
    select: {
      orderNumber: true,
      createdAt: true,
      isB2B: true,
      gstin: true,
      deliveryState: true,
      subtotal: true,
      cgstAmount: true,
      sgstAmount: true,
      igstAmount: true,
      gstAmount: true,
      totalAmount: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return orders.map((o) => ({
    orderNumber: o.orderNumber,
    date: o.createdAt.toISOString().slice(0, 10),
    isB2B: o.isB2B,
    gstin: o.gstin,
    state: o.deliveryState,
    taxableValuePaise: o.subtotal,
    cgstPaise: o.cgstAmount,
    sgstPaise: o.sgstAmount,
    igstPaise: o.igstAmount,
    totalTaxPaise: o.gstAmount,
    invoiceValuePaise: o.totalAmount,
  }));
}

// ---------------- dashboard recent-activity feed (audit tail) ----------------

export interface ActivityItem {
  id: string;
  action: string;
  label: string;
  subject: string | null;
  actorName: string;
  at: Date;
  tone: 'order' | 'return' | 'stock' | 'promo' | 'system';
}

// Audit actions the ops dashboard cares about, mapped to human copy.
const ACTIVITY_LABELS: Record<string, { label: string; tone: ActivityItem['tone'] }> = {
  ORDER_CREATED: { label: 'Order placed', tone: 'order' },
  ORDER_CANCELLED_BY_CUSTOMER: { label: 'Customer cancelled order', tone: 'order' },
  ORDER_ADDRESS_EDITED_BY_CUSTOMER: { label: 'Customer edited delivery address', tone: 'order' },
  RETURN_REQUESTED_BY_CUSTOMER: { label: 'Return requested', tone: 'return' },
  RETURN_APPROVE: { label: 'Return approved', tone: 'return' },
  RETURN_REJECT: { label: 'Return rejected', tone: 'return' },
  RETURN_MARK_RESTOCKED: { label: 'Return restocked', tone: 'return' },
  RETURN_MARK_REFUNDED: { label: 'Refund marked complete', tone: 'return' },
  STOCK_ADJUSTED: { label: 'Stock adjusted', tone: 'stock' },
  INVENTORY_BULK_IMPORT: { label: 'Stock CSV imported', tone: 'stock' },
  PRODUCT_CREATED: { label: 'Product created', tone: 'stock' },
  PRODUCT_UPDATED: { label: 'Product updated', tone: 'stock' },
  PRODUCT_FLAG_TOGGLED: { label: 'Product flag toggled', tone: 'stock' },
  PRODUCT_ARCHIVED: { label: 'Product archived', tone: 'stock' },
  BRAND_CREATED: { label: 'Brand created', tone: 'stock' },
  BRAND_UPDATED: { label: 'Brand updated', tone: 'stock' },
  BRAND_DELETED: { label: 'Brand deleted', tone: 'stock' },
  COUPON_CREATED: { label: 'Coupon created', tone: 'promo' },
  COUPON_UPDATED: { label: 'Coupon updated', tone: 'promo' },
  COUPON_DELETED: { label: 'Coupon deleted', tone: 'promo' },
  COUPON_DEACTIVATED_HAS_REDEMPTIONS: { label: 'Coupon deactivated (has redemptions)', tone: 'promo' },
  BANNER_CREATED: { label: 'Banner created', tone: 'promo' },
  BANNER_UPDATED: { label: 'Banner updated', tone: 'promo' },
  BANNER_DELETED: { label: 'Banner deleted', tone: 'promo' },
  SHIPMENT_CREATED: { label: 'Shipment booked', tone: 'order' },
  WHATSAPP_DISPATCH_SIMULATED: { label: 'WhatsApp simulated', tone: 'system' },
  WHATSAPP_DISPATCH: { label: 'WhatsApp sent', tone: 'system' },
};

const CUID_RE = /^c[a-z0-9]{20,}$/i;

/** Pull a human-readable subject out of the audit row for the given action. */
function extractSubject(action: string, entity: string, entityId: string | null, detailsJson: string | null): string | null {
  let d: Record<string, unknown> = {};
  try {
    if (detailsJson) d = JSON.parse(detailsJson) as Record<string, unknown>;
  } catch {
    // details is best-effort only
  }
  const str = (k: string): string | null => (typeof d[k] === 'string' ? (d[k] as string) : null);
  const num = (k: string): number | null => (typeof d[k] === 'number' ? (d[k] as number) : null);

  const candidate =
    str('orderNumber') ??
    str('awb') ??
    str('code') ??
    str('title') ??
    str('name') ??
    (Array.isArray(d.fields) ? d.fields.join(', ') : null) ??
    str('template');

  if (candidate) return candidate;
  if (action === 'STOCK_ADJUSTED') {
    const delta = num('delta');
    const reason = str('reason') ?? 'adjustment';
    return delta === null ? reason : `${reason.replaceAll('_', ' ').toLowerCase()} ${delta > 0 ? '+' : ''}${delta}`;
  }
  if (action === 'INVENTORY_BULK_IMPORT') {
    const adjusted = num('adjusted');
    return adjusted === null ? null : `${adjusted} rows adjusted`;
  }
  // Never print a raw cuid — fall back to the entity family it belongs to.
  if (entityId && !CUID_RE.test(entityId)) return entityId;
  return entity.toLowerCase().replaceAll('_', ' ') || null;
}

/**
 * Newest-first audit tail for the dashboard "Recent activity" card.
 * Unknown actions fall back to a prettified action code so nothing silently disappears.
 */
export async function getRecentActivity(take = 12): Promise<ActivityItem[]> {
  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: { user: { select: { fullName: true, role: true } } },
  });

  return rows.map((row) => {
    const known = ACTIVITY_LABELS[row.action];
    return {
      id: row.id,
      action: row.action,
      label: known?.label ?? row.action.replaceAll('_', ' ').toLowerCase(),
      subject: extractSubject(row.action, row.entity, row.entityId, row.details),
      actorName: row.user?.fullName?.trim() || (row.user ? row.user.role : 'system'),
      at: row.createdAt,
      tone: known?.tone ?? 'system',
    };
  });
}
