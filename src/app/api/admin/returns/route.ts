// GET /api/admin/returns — RMA queue for the ops console (ORDER_MANAGER+).
// PATCH /api/admin/returns — drive a return through APPROVE / REJECT /
// MARK_RESTOCKED / MARK_REFUNDED (all transitions audit-logged, FSM-enforced).

import { fail, ok, parseBody, requireRole } from '@/lib/api-helpers';
import { ROLES } from '@/lib/constants';
import { returnActionSchema } from '@/lib/validators';
import { actOnReturn, listReturnsForAdmin, TransitionError } from '@/server/services/order.service';

const ORDER_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ORDER_MANAGER];

export async function GET(req: Request) {
  const session = await requireRole(ORDER_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const status = new URL(req.url).searchParams.get('status') ?? undefined;
  const returns = await listReturnsForAdmin(status && status !== 'ALL' ? status : undefined);
  return ok({ returns });
}

export async function PATCH(req: Request) {
  const session = await requireRole(ORDER_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, returnActionSchema);
  if (error) return error;

  const returnId = new URL(req.url).searchParams.get('id');
  if (!returnId) return fail('Missing return id (?id=)', 400);

  try {
    await actOnReturn(returnId, data.action, session.userId, session.fullName || session.email);
    return ok({ updated: true, action: data.action });
  } catch (err) {
    if (err instanceof TransitionError) return fail(err.message, 409);
    console.error('[api/admin/returns] failed', err);
    return fail('Return action failed', 500);
  }
}
