// PATCH /api/admin/staff/[id] — edit a staff/owner account (owner only, D-12):
// rename, reset password, change granted scopes, activate/deactivate.

import { fail, ok, parseBody, requireOwner } from '@/lib/api-helpers';
import { staffUpdateSchema } from '@/lib/validators';
import { StaffServiceError, updateAccount } from '@/server/services/staff.service';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOwner();
  if (!session) return fail('Owner access required', 401);
  const { id } = await params;
  const { data, error } = await parseBody(req, staffUpdateSchema);
  if (error) return error;
  try {
    return ok(await updateAccount(session.userId, session.role, id, data));
  } catch (err) {
    if (err instanceof StaffServiceError) return fail(err.message, err.status);
    throw err;
  }
}
