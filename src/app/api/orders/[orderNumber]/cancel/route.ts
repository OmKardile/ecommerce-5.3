// POST /api/orders/[orderNumber]/cancel — customer self-service cancellation.
// Owner only; allowed while the order is pre-pack (PENDING_PAYMENT … PROCESSING).
// Releases reserved stock through the order FSM side effects (ADR-010).

import { fail, ok } from '@/lib/api-helpers';
import { getCustomerSession } from '@/lib/session';
import { cancelOrderByCustomer } from '@/server/services/order.service';

export async function POST(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const session = await getCustomerSession();
  if (!session) return fail('Sign in to manage your orders', 401);

  const { orderNumber } = await params;

  let reason: string | undefined;
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (typeof body?.reason === 'string' && body.reason.trim()) reason = body.reason.trim().slice(0, 500);
  } catch {
    // body optional
  }

  try {
    const result = await cancelOrderByCustomer(decodeURIComponent(orderNumber), session.userId, reason);
    if (!result.ok) return fail(result.error, result.status ?? 400);
    return ok({ cancelled: true, status: result.status });
  } catch (err) {
    console.error('[api/orders/cancel] failed', err);
    return fail('Could not cancel the order. Try again or contact the trade desk.', 500);
  }
}
