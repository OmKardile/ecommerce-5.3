// POST /api/admin/orders/transition — move an order through the strict FSM (ADR-010).
// ORDER_MANAGER / ADMIN / SUPER_ADMIN only. TransitionError -> 409.

import { fail, ok, parseBody, requireRole } from '@/lib/api-helpers';
import { orderTransitionSchema } from '@/lib/validators';
import { ROLES } from '@/lib/constants';
import { transitionOrder, TransitionError } from '@/server/services/order.service';
import { recordAudit } from '@/server/services/notification.service';

const ORDER_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ORDER_MANAGER];

export async function POST(req: Request) {
  const session = await requireRole(ORDER_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, orderTransitionSchema);
  if (error) return error;

  try {
    await transitionOrder(data.orderId, data.status as Parameters<typeof transitionOrder>[1], data.comment ?? `Changed by ${session.fullName || session.email}`, session.userId);
    await recordAudit('ORDER_STATUS_TRANSITION', 'ORDER', data.orderId, { nextStatus: data.status, comment: data.comment ?? null }, session.userId);
    return ok({ orderId: data.orderId, status: data.status });
  } catch (err) {
    if (err instanceof TransitionError) return fail(err.message, 409);
    console.error('[api/admin/orders/transition] failed', err);
    return fail('Transition failed', 500);
  }
}
