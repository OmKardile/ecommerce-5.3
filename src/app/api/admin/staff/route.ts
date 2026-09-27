// /api/admin/staff — GET list operator accounts + POST create (owner only, D-12).
// POST creates STAFF (scoped via the wizard) or SUPER_ADMIN (implicitly full).

import { fail, ok, parseBody, requireOwner } from '@/lib/api-helpers';
import { staffCreateSchema } from '@/lib/validators';
import { StaffServiceError, createAccount, listAccounts } from '@/server/services/staff.service';

export async function GET() {
  const session = await requireOwner();
  if (!session) return fail('Owner access required', 401);
  return ok(await listAccounts());
}

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return fail('Owner access required', 401);
  const { data, error } = await parseBody(req, staffCreateSchema);
  if (error) return error;
  try {
    const user = await createAccount(session.userId, data);
    return ok(user, 201);
  } catch (err) {
    if (err instanceof StaffServiceError) return fail(err.message, err.status);
    throw err;
  }
}
