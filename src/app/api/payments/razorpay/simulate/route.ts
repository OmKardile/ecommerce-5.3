import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helpers';
import { getCustomerSession } from '@/lib/session';
import { simulateSuccessfulPayment } from '@/server/services/payment.service';
import { db } from '@/lib/db';

// Sandbox-only endpoint: drives the full payment lifecycle (order -> capture) without real keys.
// Refuses to run when live Razorpay credentials are configured (no fabricated success in production).
export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return fail('Login required', 401);
  const { orderId, outcome } = (await req.json()) as { orderId?: string; outcome?: 'success' | 'failure' };
  if (!orderId) return fail('orderId required', 400);
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== session.userId) return fail('Order not found', 404);

  if (outcome === 'failure') {
    await db.payment.updateMany({ where: { orderId, status: 'INITIATED' }, data: { status: 'FAILED' } });
    await db.orderStatusHistory.create({
      data: { orderId, status: order.status, comment: 'Simulated payment failure', changedBy: 'SANDBOX' },
    });
    return ok({ simulated: true, outcome: 'failure' });
  }

  const sim = await simulateSuccessfulPayment(orderId);
  if (!sim) return fail('Simulation mode unavailable: live gateway configured', 403);
  const verify = await fetch(new URL('/api/payments/razorpay/verify', req.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
    body: JSON.stringify({
      razorpay_order_id: sim.gatewayOrderId,
      razorpay_payment_id: sim.gatewayPaymentId,
      razorpay_signature: sim.signature,
    }),
  });
  const json = (await verify.json()) as { ok: boolean; data?: { alreadyProcessed?: boolean } };
  return ok({ simulated: true, outcome: 'success', verified: json.ok, orderNumber: order.orderNumber });
}
