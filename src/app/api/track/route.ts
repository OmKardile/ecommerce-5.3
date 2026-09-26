import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, fail, parseBody, clientIp } from '@/lib/api-helpers';
import { phoneSchema } from '@/lib/validators';
import { normalizeIndianPhone } from '@/lib/phone';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';

// POST /api/track — public order tracking. Verifies the delivery/login phone before
// revealing anything, and returns a sanitized projection (no addresses, amounts or ids).
//
// Two modes:
//  - detail: { orderNumber, phone }  -> full sanitized tracking projection for ONE order
//  - list:   { phone }               -> minimal "my orders" index for that phone
//             (order number, status, placed date, item COUNT — no names, no amounts).
//             The phone number itself is the credential here; the list endpoint is
//             rate-limited harder and deliberately returns the minimum needed to pick
//             an order and continue into the verified detail lookup.

const trackSchema = z.object({
  orderNumber: z.string().trim().max(40).optional().default(''),
  phone: phoneSchema,
});

function sanitizePhone(phone: string): string {
  return `+91 ${phone.replace(/\D/g, '').slice(-10).replace(/(\d{5})(\d{5})/, '$1 $2')}`;
}

const LIST_WINDOW_DAYS = 180;

export async function POST(req: NextRequest) {
  // Detail lookups are per-order (phone acts as proof); list lookups enumerate by
  // phone alone, so they get a tighter bucket.
  const { data, error } = await parseBody(req, trackSchema);
  if (error) return error;

  const wantsList = !data.orderNumber;
  const rl = rateLimit(`track:${clientIp(req)}`, wantsList ? 5 : 20, 60 * 1000);
  if (!rl.ok) return fail('Too many lookups — wait a minute and retry', 429);

  const inputPhone = normalizeIndianPhone(data.phone);
  if (!inputPhone) return fail('Enter a valid 10-digit mobile number', 400);

  if (wantsList) return listMode(inputPhone);
  return detailMode(data.orderNumber as string, inputPhone);
}

// ---------------- list mode: minimal order index for a phone ----------------

async function listMode(inputPhone: string) {
  const since = new Date(Date.now() - LIST_WINDOW_DAYS * 86400000);
  const orders = await db.order.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: since },
      OR: [{ deliveryPhone: inputPhone }, { user: { phone: inputPhone } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      orderNumber: true,
      status: true,
      paymentMethod: true,
      createdAt: true,
      estimatedDeliveryAt: true,
      _count: { select: { items: true } },
      returns: { select: { status: true }, take: 1, orderBy: { createdAt: 'desc' } },
    },
  });

  return ok({
    mode: 'list' as const,
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      paymentMethod: o.paymentMethod,
      placedAt: o.createdAt.toISOString(),
      estimatedDeliveryAt: o.estimatedDeliveryAt ? o.estimatedDeliveryAt.toISOString() : null,
      itemCount: o._count.items,
      returnStatus: o.returns[0]?.status ?? null,
    })),
  });
}

// ---------------- detail mode: one verified order ----------------

async function detailMode(orderNumber: string, inputPhone: string) {
  const order = await db.order.findUnique({
    where: { orderNumber: orderNumber.toUpperCase() },
    include: {
      user: { select: { phone: true } },
      items: { select: { productName: true, variantName: true, quantity: true } },
      statusHistory: { orderBy: { createdAt: 'asc' }, select: { status: true, comment: true, createdAt: true } },
      payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, method: true } },
      returns: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, createdAt: true, reason: true } },
      shipments: {
        include: { events: { orderBy: { occurredAt: 'asc' }, select: { status: true, location: true, occurredAt: true } } },
      },
    },
  });
  if (!order) return fail('No order found with that number', 404);

  const deliveryPhone = normalizeIndianPhone(order.deliveryPhone);
  const userPhone = normalizeIndianPhone(order.user.phone);
  if (inputPhone !== deliveryPhone && inputPhone !== userPhone) {
    return fail('This phone number does not match the order', 403);
  }

  const shipment = order.shipments[0] ?? null;
  const latestReturn = order.returns[0] ?? null;
  const latestPayment = order.payments[0] ?? null;

  return ok({
    mode: 'detail' as const,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: latestPayment?.status ?? null,
    placedAt: order.createdAt.toISOString(),
    estimatedDeliveryAt: order.estimatedDeliveryAt ? order.estimatedDeliveryAt.toISOString() : null,
    contactPhone: sanitizePhone(order.deliveryPhone),
    items: order.items.map((i) => ({ name: i.productName, variant: i.variantName, quantity: i.quantity })),
    return: latestReturn
      ? { status: latestReturn.status, createdAt: latestReturn.createdAt.toISOString() }
      : null,
    shipment: shipment
      ? {
          courier: shipment.courierName,
          awb: shipment.awb,
          trackingUrl: shipment.trackingUrl,
          status: shipment.status,
          events: shipment.events.map((e) => ({ status: e.status, location: e.location, occurredAt: e.occurredAt.toISOString() })),
        }
      : null,
    statusHistory: order.statusHistory.map((h) => ({ status: h.status, comment: h.comment, at: h.createdAt.toISOString() })),
  });
}
