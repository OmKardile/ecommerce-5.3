// Order service — concurrency-safe order creation & strict state machine (ADR-010).

import { randomInt } from 'crypto';
import { db } from '@/lib/db';
import {
  COD_MAX_ORDER_VALUE_PAISE,
  COD_FEE_PAISE,
  DEFAULT_SHIPPING_FEE_PAISE,
  FREE_SHIPPING_THRESHOLD_PAISE,
  ORDER_TRANSITIONS,
  type OrderStatus,
} from '@/lib/constants';
import { splitGstInclusive } from '@/lib/gst';
import { estimateDelivery, resolveZone } from '@/lib/pincodes';
import { adjustStock, availableOf } from './inventory.service';
import { evaluateCoupon, recordRedemption } from './coupon.service';
import { getCartView, computeBundleDiscount } from './cart.service';
import { getSettings } from './settings.service';
import { sendWhatsAppTemplate, recordAudit } from './notification.service';
import type { CheckoutInput, OrderAddressUpdateInput } from '@/lib/validators';

type AddressUpdateFields = OrderAddressUpdateInput;

export class OrderError extends Error {
  status: number;
  code: string;
  constructor(message: string, code = 'ORDER_ERROR', status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  return `PN-${year}-${String(randomInt(1, 999999)).padStart(6, '0')}`;
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  paymentMethod: 'RAZORPAY' | 'COD';
}

export async function createOrderFromCart(userId: string, input: CheckoutInput): Promise<CreateOrderResult> {
  // idempotency: same key returns the existing order
  const existing = await db.order.findFirst({ where: { customerNote: { contains: `idem:${input.idempotencyKey}` } } });
  if (existing) {
    return {
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      status: existing.status as OrderStatus,
      totalAmount: existing.totalAmount,
      paymentMethod: existing.paymentMethod as 'RAZORPAY' | 'COD',
    };
  }

  const cart = await getCartView();
  if (!cart.lines.length) throw new OrderError('Your cart is empty', 'EMPTY_CART', 400);
  if (cart.hasOutOfStock) throw new OrderError('Some items are no longer available in the requested quantity', 'OUT_OF_STOCK', 409);

  const settings = await getSettings();
  const user = await db.user.findUnique({ where: { id: userId }, include: { customer: true } });
  if (!user?.customer) throw new OrderError('Customer profile missing', 'NO_CUSTOMER', 400);

  // ---- server-side pricing (zero trust) ----
  let subtotal = cart.subtotalPaise;

  // bundle discount (ADR-006) — same server rule as the cart view (recorder + camera gate)
  const { discountPaise: bundleDiscount, bundleApplied } = await computeBundleDiscount(cart.lines);

  // coupon (server-validated)
  let discount = 0;
  let couponId: string | null = null;
  let couponCode: string | null = null;
  if (input.couponCode) {
    const evaluation = await evaluateCoupon(input.couponCode, subtotal);
    if (!evaluation.valid) throw new OrderError(evaluation.reason ?? 'Coupon invalid', 'COUPON_INVALID', 400);
    discount = evaluation.discountPaise;
    couponId = evaluation.coupon?.id ?? null;
    couponCode = evaluation.coupon?.code ?? null;
  }

  // shipping fee
  const zone = resolveZone(input.delivery.pincode);
  let shippingAmount = subtotal >= settings.freeShippingThresholdPaise ? 0 : settings.shippingFeePaise;
  if (zone.zone === 'SPECIAL') shippingAmount = Math.max(shippingAmount, 19900); // air-cargo handling (documented policy)

  // COD rules (ADR-004)
  const isCod = input.paymentMethod === 'COD';
  let codFee = 0;
  if (isCod) {
    if (!cart.allCodAllowed) throw new OrderError('Some items are prepaid-only; COD is unavailable for this cart', 'COD_BLOCKED_ITEM', 400);
    if (subtotal > settings.codMaxOrderValuePaise) throw new OrderError('COD is available on orders up to ₹15,000', 'COD_LIMIT', 400);
    if (!zone.codAvailable) throw new OrderError('COD is not serviceable at this PIN code (air-cargo zone)', 'COD_BLOCKED_ZONE', 400);
    codFee = settings.codFeePaise;
  }

  // B2B GSTIN capture
  if (input.isB2B && (!input.gstin || !input.companyName)) {
    throw new OrderError('GSTIN and business name are required for business purchases', 'B2B_MISSING', 400);
  }

  const discountedSubtotal = Math.max(subtotal - discount - bundleDiscount, 0);
  const totalAmount = discountedSubtotal + shippingAmount + codFee;

  // GST split per line (inclusive), proportional coupon allocation
  let gstAmount = 0, cgst = 0, sgst = 0, igst = 0;
  const intra = zone.zone === 'INTRA_STATE';
  const scale = subtotal > 0 ? discountedSubtotal / subtotal : 1;
  for (const line of cart.lines) {
    const lineDiscounted = Math.round(line.lineTotalPaise * scale);
    const split = splitGstInclusive(lineDiscounted, line.taxRate, intra ? 'Gujarat' : 'Maharashtra');
    gstAmount += split.gst;
    cgst += split.cgst;
    sgst += split.sgst;
    igst += split.igst;
  }

  const orderNumber = generateOrderNumber();
  const estimated = estimateDelivery(input.delivery.pincode);

  const order = await db.$transaction(
    async (tx) => {
      // reserve stock inside the transaction — no overselling (ADR-010)
      for (const line of cart.lines) {
        const inv = await tx.inventory.findUnique({ where: { skuId: line.skuId } });
        if (!inv || availableOf(inv) < line.quantity) {
          throw new OrderError(`Insufficient stock for ${line.productName} (${line.variantName})`, 'INSUFFICIENT_STOCK', 409);
        }
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: isCod ? 'COD_PENDING' : 'PENDING_PAYMENT',
          paymentMethod: isCod ? 'COD' : 'RAZORPAY',
          isB2B: input.isB2B,
          gstin: input.isB2B ? input.gstin : null,
          companyName: input.isB2B ? input.companyName : null,
          subtotal,
          discountAmount: discount,
          bundleDiscount,
          bundleName: bundleApplied?.name ?? null,
          couponCode,
          shippingAmount,
          codFee,
          gstAmount,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          totalAmount,
          deliveryName: input.delivery.recipientName,
          deliveryPhone: input.delivery.phone,
          deliveryLine1: input.delivery.addressLine1,
          deliveryLine2: input.delivery.addressLine2 || null,
          deliveryLandmark: input.delivery.landmark || null,
          deliveryCity: input.delivery.city,
          deliveryState: input.delivery.state,
          deliveryPincode: input.delivery.pincode,
          customerNote: `idem:${input.idempotencyKey}${input.customerNote ? ` | ${input.customerNote}` : ''}`,
          estimatedDeliveryAt: estimated,
          items: {
            create: cart.lines.map((line) => {
              const split = splitGstInclusive(line.unitPricePaise, line.taxRate, intra ? 'Gujarat' : 'Maharashtra');
              return {
                skuId: line.skuId,
                productName: line.productName,
                variantName: line.variantName,
                skuCode: line.skuCode,
                hsnCode: '8525',
                quantity: line.quantity,
                unitPrice: line.unitPricePaise,
                taxRate: line.taxRate,
                taxAmount: split.gst * line.quantity,
                totalPrice: line.lineTotalPaise,
                isCodAllowed: line.isCodAllowed,
                serialNumbers: JSON.stringify([]),
              };
            }),
          },
        },
        include: { items: true },
      });

      await tx.orderStatusHistory.create({
        data: { orderId: created.id, status: created.status, comment: 'Order created at checkout', changedBy: 'SYSTEM' },
      });

      // reserve inventory
      for (const line of cart.lines) {
        await tx.inventory.update({ where: { skuId: line.skuId }, data: { reservedStock: { increment: line.quantity } } });
        await tx.inventoryMovement.create({
          data: { skuId: line.skuId, quantity: -line.quantity, reason: 'ORDER_RESERVED', referenceId: created.id, notes: `Order ${orderNumber}` },
        });
      }

      // snapshot delivery address to the address book when requested
      if (input.saveAddress && user.customer) {
        await tx.address.create({
          data: {
            customerId: user.customer.id,
            recipientName: input.delivery.recipientName,
            phone: input.delivery.phone,
            addressLine1: input.delivery.addressLine1,
            addressLine2: input.delivery.addressLine2 || null,
            landmark: input.delivery.landmark || null,
            city: input.delivery.city,
            state: input.delivery.state,
            pincode: input.delivery.pincode,
            type: 'HOME',
          },
        });
      }

      return created;
    },
    { maxWait: 15000, timeout: 30000 }
  );

  if (couponId) await recordRedemption(couponId, order.id, discount);

  // clear the cart (reservation succeeded)
  const cartRecord = await db.cart.findFirst({ where: { OR: [{ userId }, { user: { id: userId } }] } });
  if (cartRecord) await db.cartItem.deleteMany({ where: { cartId: cartRecord.id } });

  // notification (dual-mode, simulated in sandbox)
  void sendWhatsAppTemplate(
    user.phone,
    isCod ? 'cod_verification' : 'order_confirmation',
    [user.customer.fullName, order.orderNumber, `₹${(order.totalAmount / 100).toLocaleString('en-IN')}`, isCod ? 'Cash on Delivery' : 'Prepaid', `${order.items.length} item(s)`]
  );
  void recordAudit('ORDER_CREATED', 'ORDER', order.id, { orderNumber, totalAmount, paymentMethod: order.paymentMethod }, userId);

  if (isCod) {
    await transitionOrder(order.id, 'CONFIRMED', 'COD order placed — pending warehouse confirmation', 'SYSTEM');
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: isCod ? 'CONFIRMED' : 'PENDING_PAYMENT',
    totalAmount,
    paymentMethod: isCod ? 'COD' : 'RAZORPAY',
  };
}

export class TransitionError extends Error {
  status = 409;
}

/** Enforce the strict finite state machine + inventory side effects. */
export async function transitionOrder(orderId: string, next: OrderStatus, comment?: string, changedBy = 'SYSTEM'): Promise<void> {
  await db.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new TransitionError('Order not found');
      const current = order.status as OrderStatus;
      if (current === next) return; // idempotent no-op
      const allowed = ORDER_TRANSITIONS[current] ?? [];
      if (!allowed.includes(next)) {
        throw new TransitionError(`Cannot move order from ${current} to ${next}`);
      }

      await tx.order.update({ where: { id: orderId }, data: { status: next } });
      await tx.orderStatusHistory.create({ data: { orderId, status: next, comment, changedBy } });

      // inventory side effects
      const items = order.items.map((i) => ({ skuId: i.skuId, quantity: i.quantity }));
      if (next === 'CANCELLED' && (current === 'PENDING_PAYMENT' || current === 'COD_PENDING' || current === 'PAID' || current === 'CONFIRMED' || current === 'PROCESSING')) {
        for (const item of items) {
          const inv = await tx.inventory.findUnique({ where: { skuId: item.skuId } });
          if (!inv) continue;
          const release = Math.min(item.quantity, inv.reservedStock);
          await tx.inventory.update({ where: { skuId: item.skuId }, data: { reservedStock: { decrement: release } } });
          await tx.inventoryMovement.create({
            data: { skuId: item.skuId, quantity: item.quantity, reason: 'ORDER_CANCELLED_RESTOCK', referenceId: orderId, notes: 'Order cancelled' },
          });
        }
      }
      if (next === 'SHIPPED' && current === 'PACKED') {
        for (const item of items) {
          const inv = await tx.inventory.findUnique({ where: { skuId: item.skuId } });
          if (!inv) continue;
          const qty = Math.min(item.quantity, inv.reservedStock, inv.currentStock);
          await tx.inventory.update({
            where: { skuId: item.skuId },
            data: { currentStock: { decrement: qty }, reservedStock: { decrement: qty } },
          });
          await tx.inventoryMovement.create({
            data: { skuId: item.skuId, quantity: -qty, reason: 'ORDER_DISPATCHED', referenceId: orderId, notes: 'Physical dispatch' },
          });
        }
      }
    },
    { maxWait: 15000, timeout: 30000 }
  );
}

// ============================================================
// Customer self-service: cancellation & 7-day DOA / return requests
// ============================================================

/** Statuses a customer may self-cancel. Once PACKED at the hub, the desk handles it. */
const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'COD_PENDING', 'PAID', 'CONFIRMED', 'PROCESSING'];
/** Same window for self-service address edits — anything not yet packed. */
const CUSTOMER_ADDRESS_EDITABLE_STATUSES: OrderStatus[] = CUSTOMER_CANCELLABLE_STATUSES;
/** Return/DOA window per the published return policy. */
const RETURN_WINDOW_DAYS = 7;

type CustomerOrderOutcome = { ok: true; status: OrderStatus } | { ok: false; error: string; status?: number };

async function findOwnedOrder(orderNumber: string, userId: string) {
  return db.order.findFirst({ where: { orderNumber, userId }, include: { items: true, user: { select: { phone: true } } } });
}

/** Customer-initiated cancellation — releases reserved stock via the FSM side effects. */
export async function cancelOrderByCustomer(
  orderNumber: string,
  userId: string,
  reason?: string,
): Promise<CustomerOrderOutcome> {
  const order = await findOwnedOrder(orderNumber, userId);
  if (!order) return { ok: false, error: 'Order not found', status: 404 };

  const current = order.status as OrderStatus;
  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(current)) {
    return { ok: false, error: 'This order can no longer be cancelled online — it is packed or already dispatched. Contact our trade desk for help.', status: 409 };
  }

  const comment = reason?.trim() ? `Cancelled by customer: ${reason.trim()}` : 'Cancelled by customer';
  await transitionOrder(order.id, 'CANCELLED', comment, `CUSTOMER:${userId}`);

  void sendWhatsAppTemplate(order.user.phone, 'order_cancelled', [
    order.orderNumber,
    `\u20B9${(order.totalAmount / 100).toLocaleString('en-IN')}`,
  ]);
  void recordAudit('ORDER_CANCELLED_BY_CUSTOMER', 'ORDER', order.id, { orderNumber, reason: reason ?? null }, userId);

  return { ok: true, status: 'CANCELLED' };
}

/** Customer-initiated return / DOA replacement request (7-day window from delivery scan). */
export async function requestReturnByCustomer(
  orderNumber: string,
  userId: string,
  reason: string,
): Promise<CustomerOrderOutcome> {
  if (!reason || reason.trim().length < 10) {
    return { ok: false, error: 'Describe the issue in at least 10 characters so the desk can act on it.' };
  }

  const order = await findOwnedOrder(orderNumber, userId);
  if (!order) return { ok: false, error: 'Order not found', status: 404 };

  const current = order.status as OrderStatus;
  if (current === 'RETURN_REQUESTED' || current === 'RETURNED' || current === 'REFUNDED') {
    return { ok: false, error: 'A return for this order is already in the pipeline — track it from this page.', status: 409 };
  }
  if (current !== 'DELIVERED') {
    return { ok: false, error: 'Returns can be requested once the order is delivered.', status: 409 };
  }

  const deliveredAt = await db.orderStatusHistory.findFirst({
    where: { orderId: order.id, status: 'DELIVERED' },
    orderBy: { createdAt: 'desc' },
  });
  if (deliveredAt) {
    const windowEnd = deliveredAt.createdAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() > windowEnd) {
      return { ok: false, error: `The ${RETURN_WINDOW_DAYS}-day return window for this order has closed. Manufacturer warranty claims run through the product serial.`, status: 409 };
    }
  }

  const openReturn = await db.orderReturn.findFirst({ where: { orderId: order.id, status: { in: ['REQUESTED', 'APPROVED'] } } });
  if (openReturn) return { ok: false, error: 'A return request for this order is already being processed.', status: 409 };

  await db.orderReturn.create({
    data: { orderId: order.id, reason: reason.trim(), status: 'REQUESTED' },
  });
  await transitionOrder(order.id, 'RETURN_REQUESTED', `Return request: ${reason.trim()}`, `CUSTOMER:${userId}`);

  void sendWhatsAppTemplate(order.user.phone, 'return_requested', [
    order.orderNumber,
    reason.trim().slice(0, 80),
  ]);
  void recordAudit('RETURN_REQUESTED_BY_CUSTOMER', 'ORDER', order.id, { orderNumber, reason: reason.trim() }, userId);

  return { ok: true, status: 'RETURN_REQUESTED' };
}

/** Customer-initiated delivery address edit — allowed until the order is packed.
 *  PIN code & state are immutable (they drive zone/COD/GST split); everything else is editable. */
export async function updateDeliveryAddressByCustomer(
  orderNumber: string,
  userId: string,
  input: AddressUpdateFields,
): Promise<CustomerOrderOutcome> {
  const order = await findOwnedOrder(orderNumber, userId);
  if (!order) return { ok: false, error: 'Order not found', status: 404 };

  const current = order.status as OrderStatus;
  if (!CUSTOMER_ADDRESS_EDITABLE_STATUSES.includes(current)) {
    return {
      ok: false,
      error: 'This order is packed or already dispatched — the address can no longer be edited online. Call our trade desk and we will try to intercept the shipment.',
      status: 409,
    };
  }

  await db.order.update({
    where: { id: order.id },
    data: {
      deliveryName: input.recipientName,
      deliveryPhone: input.phone,
      deliveryLine1: input.addressLine1,
      deliveryLine2: input.addressLine2 || null,
      deliveryLandmark: input.landmark || null,
      deliveryCity: input.city,
    },
  });

  await db.orderStatusHistory.create({
    data: {
      orderId: order.id,
      status: current,
      comment: `Delivery address updated by customer — now delivering to ${input.recipientName}, ${input.city}`,
      changedBy: `CUSTOMER:${userId}`,
    },
  });

  void sendWhatsAppTemplate(order.user.phone, 'address_updated', [
    order.orderNumber,
    input.recipientName,
    `${input.addressLine1}, ${input.city}`,
  ]);
  void recordAudit('ORDER_ADDRESS_EDITED_BY_CUSTOMER', 'ORDER', order.id, { orderNumber, city: input.city, pincode: order.deliveryPincode }, userId);

  return { ok: true, status: current };
}

export async function getOrderByNumber(orderNumber: string) {
  return db.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
      payments: true,
      shipments: { include: { events: { orderBy: { occurredAt: 'asc' } } } },
      returns: { orderBy: { createdAt: 'desc' } },
      user: { select: { phone: true, fullName: true } },
    },
  });
}

export async function getOrdersForUser(userId: string) {
  return db.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { items: { take: 3 }, payments: true },
  });
}

export { COD_MAX_ORDER_VALUE_PAISE, COD_FEE_PAISE, DEFAULT_SHIPPING_FEE_PAISE, FREE_SHIPPING_THRESHOLD_PAISE };

// ============================================================
// Admin returns queue — RMA pipeline (REQUESTED → APPROVED → RESTOCKED → REFUNDED)
// ============================================================

export type ReturnQueueRow = Awaited<ReturnType<typeof listReturnsForAdmin>>[number];

export async function listReturnsForAdmin(status?: string) {
  return db.orderReturn.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      reason: true,
      status: true,
      refundAmount: true,
      inwardCourier: true,
      inwardTracking: true,
      inwardNote: true,
      inwardAt: true,
      createdAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          paymentMethod: true,
          deliveryName: true,
          deliveryPhone: true,
          user: { select: { phone: true, fullName: true } },
          items: { select: { id: true, productName: true, variantName: true, skuCode: true, quantity: true, serialNumbers: true } },
        },
      },
    },
  });
}

export async function countOpenReturns(): Promise<number> {
  return db.orderReturn.count({ where: { status: { in: ['REQUESTED', 'APPROVED'] } } });
}

export type ReturnAction = 'APPROVE' | 'REJECT' | 'MARK_RESTOCKED' | 'MARK_REFUNDED';

/** Courier-inward evidence captured at unit receipt (MARK_RESTOCKED). */
export interface ReturnInward {
  inwardCourier?: string;
  inwardTracking?: string;
  inwardNote?: string;
}

/** Drive the RMA row + the order FSM together, with restock & refund side effects. */
export async function actOnReturn(returnId: string, action: ReturnAction, adminId: string, adminName: string, inward?: ReturnInward): Promise<{ ok: true }> {
  const ret = await db.orderReturn.findUnique({ where: { id: returnId }, include: { order: { include: { items: true, payments: true, user: { select: { phone: true } } } } } });
  if (!ret) throw new TransitionError('Return request not found');
  const order = ret.order;
  const customerPhone = order.user?.phone ?? order.deliveryPhone;
  const changedBy = adminId ? `ADMIN:${adminId}` : 'ADMIN';

  switch (action) {
    case 'APPROVE': {
      if (ret.status !== 'REQUESTED') throw new TransitionError(`Cannot approve a return in status ${ret.status}`);
      await db.orderReturn.update({ where: { id: returnId }, data: { status: 'APPROVED' } });
      // order already sits in RETURN_REQUESTED (FSM no-ops on same-status) — stamp the approval on the history directly
      await db.orderStatusHistory.create({
        data: { orderId: order.id, status: 'RETURN_REQUESTED', comment: `Return approved by ${adminName} — pickup to be arranged`, changedBy },
      });
      if (customerPhone) void sendWhatsAppTemplate(customerPhone, 'return_requested', [order.orderNumber, 'approved — pickup will be scheduled']);
      break;
    }
    case 'REJECT': {
      if (ret.status !== 'REQUESTED' && ret.status !== 'APPROVED') throw new TransitionError(`Cannot reject a return in status ${ret.status}`);
      await db.orderReturn.update({ where: { id: returnId }, data: { status: 'REJECTED' } });
      if (order.status === 'RETURN_REQUESTED') {
        await transitionOrder(order.id, 'PROCESSING', `Return rejected by ${adminName} — order reinstated for fulfillment`, changedBy);
      }
      if (customerPhone) void sendWhatsAppTemplate(customerPhone, 'return_requested', [order.orderNumber, 'not approved — our desk will call you with details']);
      break;
    }
    case 'MARK_RESTOCKED': {
      if (ret.status !== 'APPROVED') throw new TransitionError(`Unit receipt expects an APPROVED return (current ${ret.status})`);
      if (order.status !== 'RETURN_REQUESTED') throw new TransitionError(`Order is ${order.status}; expected RETURN_REQUESTED`);
      for (const item of order.items) {
        await adjustStock({ skuId: item.skuId, delta: item.quantity, reason: 'RETURN_RESTOCK', referenceId: order.id, notes: `Return ${order.orderNumber}` });
      }
      await db.orderReturn.update({
        where: { id: returnId },
        data: {
          status: 'RESTOCKED',
          isRma: true,
          inwardCourier: inward?.inwardCourier ?? null,
          inwardTracking: inward?.inwardTracking ?? null,
          inwardNote: inward?.inwardNote ?? null,
          inwardAt: new Date(),
        },
      });
      await transitionOrder(
        order.id,
        'RETURNED',
        `Returned unit received & restocked by ${adminName}${inward?.inwardCourier ? ` — inward via ${inward.inwardCourier} docket ${inward.inwardTracking}` : ''}`,
        changedBy,
      );
      break;
    }
    case 'MARK_REFUNDED': {
      if (ret.status !== 'RESTOCKED') throw new TransitionError(`Refund expects a RESTOCKED return (current ${ret.status})`);
      await db.orderReturn.update({ where: { id: returnId }, data: { status: 'REFUNDED', refundAmount: order.totalAmount } });
      await transitionOrder(order.id, 'REFUNDED', `Refund processed by ${adminName}`, changedBy);
      await db.payment.updateMany({ where: { orderId: order.id, status: 'SUCCESS' }, data: { status: 'REFUNDED' } });
      if (customerPhone) void sendWhatsAppTemplate(customerPhone, 'return_requested', [order.orderNumber, 'refund processed to source in 4-5 working days']);
      break;
    }
  }

  void recordAudit(`RETURN_${action}`, 'ORDER', order.id, { returnId, action, orderNumber: order.orderNumber, ...(action === 'MARK_RESTOCKED' && inward ? { inward } : {}) }, adminId);
  return { ok: true };
}
