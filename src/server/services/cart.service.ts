// Cart service — server-side source of truth. Zero-trust: every line revalidated against
// live SKU prices + live availability on every read (ADR-008 / technical doc §9.1).

import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { CART_COOKIE } from '@/lib/constants';
import { splitGstInclusive } from '@/lib/gst';
import { resolveZone } from '@/lib/pincodes';
import { COD_MAX_ORDER_VALUE_PAISE } from '@/lib/constants';
import { getCustomerSession } from '@/lib/session';

export interface CartLine {
  skuId: string;
  skuCode: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  image: string | null;
  quantity: number;
  unitPricePaise: number;
  mrpPaise: number;
  lineTotalPaise: number;
  taxRate: number;
  availableStock: number;
  isCodAllowed: boolean;
  inStock: boolean;
}

export interface CartView {
  lines: CartLine[];
  itemCount: number;
  subtotalPaise: number; // sum of inclusive line totals
  mrpTotalPaise: number;
  gstAmountPaise: number;
  taxableBasePaise: number;
  allCodAllowed: boolean;
  hasOutOfStock: boolean;
  bundleDiscountPaise: number;
  bundleApplied: { name: string; discountPct: number } | null;
}

async function resolveCart(createIfMissing: boolean): Promise<{ id: string; guestToken: string | null; userId: string | null } | null> {
  const session = await getCustomerSession();
  if (session) {
    let cart = await db.cart.findUnique({ where: { userId: session.userId } });
    if (!cart && createIfMissing) {
      cart = await db.cart.create({ data: { userId: session.userId } });
    }
    return cart;
  }
  const jar = await cookies();
  let token = jar.get(CART_COOKIE)?.value;
  if (token) {
    const cart = await db.cart.findUnique({ where: { guestToken: token } });
    if (cart) return cart;
  }
  if (!createIfMissing) return null;
  token = randomUUID();
  const cart = await db.cart.create({ data: { guestToken: token } });
  jar.set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return cart;
}

export async function getCartView(): Promise<CartView> {
  const cart = await resolveCart(false);
  if (!cart) return emptyCart();

  const items = await db.cartItem.findMany({
    where: { cartId: cart.id },
    include: {
      sku: {
        include: {
          inventory: true,
          variant: { include: { product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, category: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const lines: CartLine[] = [];
  let subtotal = 0;
  let mrpTotal = 0;
  let allCod = true;
  let hasOutOfStock = false;

  for (const item of items) {
    const sku = item.sku;
    const product = sku.variant?.product;
    if (!sku.variant || !product || !product.isActive || product.deletedAt) {
      await db.cartItem.delete({ where: { id: item.id } }).catch(() => undefined);
      continue;
    }
    const available = sku.inventory ? sku.inventory.currentStock - sku.inventory.reservedStock : 0;
    const inStock = available > 0;
    const quantity = Math.min(item.quantity, Math.max(available, 0));
    if (quantity !== item.quantity) {
      await db.cartItem.update({ where: { id: item.id }, data: { quantity: Math.max(quantity, 0) } }).catch(() => undefined);
    }
    if (quantity <= 0) {
      hasOutOfStock = true;
      allCod = allCod && product.isCodAllowed;
      continue;
    }
    const lineTotal = sku.sellingPrice * quantity;
    subtotal += lineTotal;
    mrpTotal += sku.mrp * quantity;
    if (!product.isCodAllowed) allCod = false;
    if (!inStock) hasOutOfStock = true;
    lines.push({
      skuId: sku.id,
      skuCode: sku.code,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantName: sku.variant.name,
      image: product.images[0]?.url ?? null,
      quantity,
      unitPricePaise: sku.sellingPrice,
      mrpPaise: sku.mrp,
      lineTotalPaise: lineTotal,
      taxRate: product.category.gstRate,
      availableStock: available,
      isCodAllowed: product.isCodAllowed,
      inStock,
    });
  }

  // GST breakdown on the cart subtotal (inclusive pricing) — destination unknown until checkout
  let gstTotal = 0;
  let baseTotal = 0;
  for (const line of lines) {
    const split = splitGstInclusive(line.lineTotalPaise, line.taxRate);
    gstTotal += split.gst;
    baseTotal += split.base;
  }

  const { discountPaise: bundleDiscountPaise, bundleApplied } = await computeBundleDiscount(lines);

  return {
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalPaise: subtotal,
    mrpTotalPaise: mrpTotal,
    gstAmountPaise: gstTotal,
    taxableBasePaise: baseTotal,
    allCodAllowed: allCod && lines.length > 0,
    hasOutOfStock,
    bundleDiscountPaise,
    bundleApplied,
  };
}

function emptyCart(): CartView {
  return {
    lines: [],
    itemCount: 0,
    subtotalPaise: 0,
    mrpTotalPaise: 0,
    gstAmountPaise: 0,
    taxableBasePaise: 0,
    allCodAllowed: true,
    hasOutOfStock: false,
    bundleDiscountPaise: 0,
    bundleApplied: null,
  };
}

/**
 * Bundle discount (ADR-006). A kit qualifies when the cart holds at least one
 * recorder-slot SKU AND one camera-slot SKU of the same active bundle — the same
 * gate the kit-builder wizard enforces before its CTA. The percentage applies ONLY
 * to the line totals whose SKUs belong to the qualifying bundle; unrelated lines
 * are never discounted. If several bundles qualify, the single best discount wins
 * (no stacking).
 */
export async function computeBundleDiscount(
  lines: { skuId: string; lineTotalPaise: number }[],
): Promise<{ discountPaise: number; bundleApplied: { name: string; discountPct: number } | null }> {
  if (!lines.length) return { discountPaise: 0, bundleApplied: null };

  const bundles = await db.bundle.findMany({
    where: { isActive: true },
    include: { items: { select: { skuId: true, slot: true } } },
  });
  if (!bundles.length) return { discountPaise: 0, bundleApplied: null };

  const lineTotalBySku = new Map<string, number>();
  for (const line of lines) {
    lineTotalBySku.set(line.skuId, (lineTotalBySku.get(line.skuId) ?? 0) + line.lineTotalPaise);
  }

  let best: { discountPaise: number; bundleApplied: { name: string; discountPct: number } | null } = {
    discountPaise: 0,
    bundleApplied: null,
  };

  for (const bundle of bundles) {
    const slotBySku = new Map(bundle.items.map((i) => [i.skuId, i.slot]));
    const skuIds = new Set(bundle.items.map((i) => i.skuId));
    const hasRecorder = lines.some((l) => slotBySku.get(l.skuId) === 'recorder');
    const hasCamera = lines.some((l) => slotBySku.get(l.skuId) === 'camera');
    if (!hasRecorder || !hasCamera) continue;

    let eligiblePaise = 0;
    for (const line of lines) {
      if (skuIds.has(line.skuId)) eligiblePaise += line.lineTotalPaise;
    }
    const discountPaise = Math.floor((eligiblePaise * bundle.discountPct) / 100);
    if (discountPaise > best.discountPaise) {
      best = { discountPaise, bundleApplied: { name: bundle.name, discountPct: bundle.discountPct } };
    }
  }

  return best;
}

export async function addToCart(skuId: string, quantity: number): Promise<{ ok: boolean; error?: string }> {
  const sku = await db.sku.findUnique({
    where: { id: skuId },
    include: { inventory: true, variant: { include: { product: true } } },
  });
  if (!sku || !sku.variant || !sku.variant.product.isActive || sku.variant.product.deletedAt) {
    return { ok: false, error: 'Product unavailable' };
  }
  const available = sku.inventory ? sku.inventory.currentStock - sku.inventory.reservedStock : 0;
  if (available < 1) return { ok: false, error: 'Out of stock' };

  const cart = await resolveCart(true);
  if (!cart) return { ok: false, error: 'Cart unavailable' };

  const existing = await db.cartItem.findUnique({ where: { cartId_skuId: { cartId: cart.id, skuId } } });
  const desired = Math.min((existing?.quantity ?? 0) + quantity, available, 99);
  if (existing) {
    await db.cartItem.update({ where: { id: existing.id }, data: { quantity: desired } });
  } else {
    await db.cartItem.create({ data: { cartId: cart.id, skuId, quantity: Math.min(quantity, available) } });
  }
  return { ok: true };
}

export async function updateCartItem(skuId: string, quantity: number): Promise<{ ok: boolean; error?: string }> {
  const cart = await resolveCart(false);
  if (!cart) return { ok: false, error: 'Cart not found' };
  const existing = await db.cartItem.findUnique({ where: { cartId_skuId: { cartId: cart.id, skuId } } });
  if (!existing) return { ok: false, error: 'Item not in cart' };
  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: existing.id } });
    return { ok: true };
  }
  const inv = await db.inventory.findUnique({ where: { skuId } });
  const available = inv ? inv.currentStock - inv.reservedStock : 0;
  if (quantity > available) return { ok: false, error: `Only ${available} unit(s) available` };
  await db.cartItem.update({ where: { id: existing.id }, data: { quantity } });
  return { ok: true };
}

export async function removeCartItem(skuId: string): Promise<void> {
  const cart = await resolveCart(false);
  if (!cart) return;
  await db.cartItem.deleteMany({ where: { cartId: cart.id, skuId } });
}

export async function clearCart(cartId: string): Promise<void> {
  await db.cartItem.deleteMany({ where: { cartId } });
}

/** Merge guest cart into the user's cart after OTP login. Returns number of merged lines. */
export async function mergeGuestCart(userId: string): Promise<number> {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return 0;
  const guestCart = await db.cart.findUnique({ where: { guestToken: token }, include: { items: true } });
  if (!guestCart || guestCart.userId === userId) return 0;
  const guestItems = guestCart.items;
  if (!guestItems.length) {
    await db.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined);
    return 0;
  }
  const userCart = await db.cart.upsert({ where: { userId }, update: {}, create: { userId } });
  let merged = 0;
  for (const item of guestItems) {
    const existing = await db.cartItem.findUnique({ where: { cartId_skuId: { cartId: userCart.id, skuId: item.skuId } } });
    if (existing) {
      await db.cartItem.update({ where: { id: existing.id }, data: { quantity: Math.min(existing.quantity + item.quantity, 99) } });
    } else {
      await db.cartItem.create({ data: { cartId: userCart.id, skuId: item.skuId, quantity: item.quantity } });
    }
    merged += 1;
  }
  await db.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined);
  jar.delete(CART_COOKIE);
  return merged;
}

export function codEligible(cart: CartView, codMaxOrderValuePaise: number = COD_MAX_ORDER_VALUE_PAISE): { eligible: boolean; reason?: string } {
  if (!cart.lines.length) return { eligible: false, reason: 'Cart is empty' };
  if (!cart.allCodAllowed) return { eligible: false, reason: 'Some items are prepaid-only (high-value or bulky hardware)' };
  if (cart.subtotalPaise > codMaxOrderValuePaise) {
    return { eligible: false, reason: 'COD is available on orders up to ₹15,000' };
  }
  return { eligible: true };
}

export function zoneForPincode(pin: string) {
  return resolveZone(pin);
}
