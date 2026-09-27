// POST /api/admin/account/credentials — the Owner changes their own login
// (email and/or password). Current password is required; audited (D-12).

import { fail, ok, parseBody, requireOwner } from '@/lib/api-helpers';
import { ownerCredentialsSchema } from '@/lib/validators';
import { StaffServiceError, changeOwnCredentials } from '@/server/services/staff.service';

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return fail('Owner access required', 401);
  const { data, error } = await parseBody(req, ownerCredentialsSchema);
  if (error) return error;
  try {
    return ok(await changeOwnCredentials(session.userId, data));
  } catch (err) {
    if (err instanceof StaffServiceError) return fail(err.message, err.status);
    throw err;
  }
}
