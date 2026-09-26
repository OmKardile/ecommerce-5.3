// POST /api/orders/[orderNumber]/returns — customer self-service return / DOA
// replacement request (7-day window from the delivery scan, per return policy).
// Creates an OrderReturn row + moves the order to RETURN_REQUESTED via the FSM.

import { fail, ok, parseBody } from '@/lib/api-helpers';
import { getCustomerSession } from '@/lib/session';
import { returnRequestSchema } from '@/lib/validators';
import { requestReturnByCustomer } from '@/server/services/order.service';

export async function POST(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const session = await getCustomerSession();
  if (!session) return fail('Sign in to manage your orders', 401);

  const { orderNumber } = await params;
  const { data, error } = await parseBody(req, returnRequestSchema);
  if (error) return error;

  try {
    const result = await requestReturnByCustomer(decodeURIComponent(orderNumber), session.userId, data.reason);
    if (!result.ok) return fail(result.error, result.status ?? 400);
    return ok({ requested: true, status: result.status });
  } catch (err) {
    console.error('[api/orders/returns] failed', err);
    return fail('Could not submit the return request. Try again or contact the trade desk.', 500);
  }
}
