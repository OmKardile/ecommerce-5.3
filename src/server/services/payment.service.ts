// Payment service — Razorpay dual-mode gateway (ADR-007/ADR-010).
// Placeholder keys -> deterministic sandbox simulation; real keys -> live REST API.
// All verification server-side (HMAC SHA-256), webhook processing idempotent.

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { ok } from '@/lib/api-helpers';

export function isRazorpayMockMode(): boolean {
  const key = process.env.RAZORPAY_KEY_ID;
  return !key || key.includes('placeholder') || key.startsWith('rzp_test_placeholder');
}

export function publicKeyId(): string {
  return process.env.RAZORPAY_KEY_ID ?? 'rzp_test_placeholder_key_id';
}

export interface GatewayOrder {
  gatewayOrderId: string;
  amountPaise: number;
  currency: 'INR';
  mock: boolean;
}

/** Create the gateway order for a pending order. */
export async function createGatewayOrder(orderId: string): Promise<GatewayOrder> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const mock = isRazorpayMockMode();
  let gatewayOrderId: string;

  if (mock) {
    gatewayOrderId = `order_sim_${randomBytes(8).toString('hex')}`;
  } else {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: order.totalAmount,
        currency: 'INR',
        receipt: order.orderNumber,
        notes: { orderNumber: order.orderNumber },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Razorpay order creation failed: ${res.status} ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { id: string };
    gatewayOrderId = json.id;
  }

  await db.payment.upsert({
    where: { gatewayOrderId },
    update: { amount: order.totalAmount, orderId },
    create: { orderId, gatewayOrderId, amount: order.totalAmount, method: 'ONLINE', status: 'INITIATED' },
  });

  return { gatewayOrderId, amountPaise: order.totalAmount, currency: 'INR', mock };
}

/** Verify a checkout callback signature (client -> verify endpoint). Idempotent. */
export async function verifyCheckoutSignature(params: {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signature: string;
}): Promise<{ verified: boolean; alreadyProcessed: boolean; orderNumber?: string; simulated?: boolean }> {
  const payment = await db.payment.findUnique({ where: { gatewayOrderId: params.gatewayOrderId } });
  if (!payment) return { verified: false, alreadyProcessed: false };

  const secret = process.env.RAZORPAY_KEY_SECRET ?? 'placeholder_secret_key';
  const expected = createHmac('sha256', secret).update(`${params.gatewayOrderId}|${params.gatewayPaymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(params.signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { verified: false, alreadyProcessed: false };

  const result = await capturePayment({
    gatewayOrderId: params.gatewayOrderId,
    gatewayPaymentId: params.gatewayPaymentId,
    eventId: `evt_checkout_${params.gatewayPaymentId}`,
    eventType: 'payment.captured.checkout',
    payload: { source: 'checkout_verification' },
  });
  return { verified: true, alreadyProcessed: result.alreadyProcessed, orderNumber: result.orderNumber, simulated: isRazorpayMockMode() };
}

/** Core idempotent capture — used by checkout verify AND the webhook. */
export async function capturePayment(params: {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  eventId: string;
  eventType: string;
  payload: unknown;
}): Promise<{ alreadyProcessed: boolean; orderNumber?: string }> {
  // dedup on event id
  const existingEvent = await db.paymentEvent.findUnique({ where: { eventId: params.eventId } });
  if (existingEvent) return { alreadyProcessed: true };

  const payment = await db.payment.findUnique({ where: { gatewayOrderId: params.gatewayOrderId }, include: { order: true } });
  if (!payment) return { alreadyProcessed: false };

  // record event first (unique constraint = atomic dedup)
  try {
    await db.paymentEvent.create({
      data: { paymentId: payment.id, eventId: params.eventId, eventType: params.eventType, payload: JSON.stringify(params.payload).slice(0, 6000) },
    });
  } catch {
    return { alreadyProcessed: true };
  }

  if (payment.status === 'SUCCESS') return { alreadyProcessed: true, orderNumber: payment.order.orderNumber };

  await db.$transaction(
    async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESS', gatewayPaymentId: params.gatewayPaymentId },
      });
      if (payment.order.status === 'PENDING_PAYMENT') {
        await tx.order.update({ where: { id: payment.orderId }, data: { status: 'PAID' } });
        await tx.orderStatusHistory.create({
          data: { orderId: payment.orderId, status: 'PAID', comment: 'Payment captured (Razorpay)', changedBy: 'SYSTEM' },
        });
      }
    },
    { maxWait: 15000, timeout: 30000 }
  );

  // fire-and-forget notification
  const order = payment.order;
  void (await import('./notification.service')).sendWhatsAppTemplate(
    order.deliveryPhone,
    'order_confirmation',
    [order.deliveryName, order.orderNumber, `₹${(order.totalAmount / 100).toLocaleString('en-IN')}`, 'Prepaid (Razorpay)', 'Surveillance hardware']
  );

  return { alreadyProcessed: false, orderNumber: payment.order.orderNumber };
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? 'placeholder_webhook_secret';
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Simulate a full successful payment for sandbox checkout (mock mode ONLY). */
export async function simulateSuccessfulPayment(orderId: string): Promise<{ gatewayOrderId: string; gatewayPaymentId: string; signature: string } | null> {
  if (!isRazorpayMockMode()) return null;
  const gw = await createGatewayOrder(orderId);
  const gatewayPaymentId = `pay_sim_${randomBytes(8).toString('hex')}`;
  const secret = process.env.RAZORPAY_KEY_SECRET ?? 'placeholder_secret_key';
  const signature = createHmac('sha256', secret).update(`${gw.gatewayOrderId}|${gatewayPaymentId}`).digest('hex');
  return { gatewayOrderId: gw.gatewayOrderId, gatewayPaymentId, signature };
}

// re-export ok for route convenience
export { ok };
