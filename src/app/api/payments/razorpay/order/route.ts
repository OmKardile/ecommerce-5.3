import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helpers';
import { getCustomerSession } from '@/lib/session';
import { createGatewayOrder, publicKeyId, isRazorpayMockMode } from '@/server/services/payment.service';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return fail('Login required', 401);
  const { orderId } = (await req.json()) as { orderId?: string };
  if (!orderId) return fail('orderId required', 400);
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== session.userId) return fail('Order not found', 404);
  if (order.status !== 'PENDING_PAYMENT') return fail('Order is not awaiting payment', 409);
  try {
    const gatewayOrder = await createGatewayOrder(orderId);
    return ok({ ...gatewayOrder, publicKeyId: publicKeyId(), mock: isRazorpayMockMode(), orderNumber: order.orderNumber });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gateway error', 502);
  }
}
