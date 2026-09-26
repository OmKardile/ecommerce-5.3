import type { NextRequest } from 'next/server';
import { ok, fail, parseBody } from '@/lib/api-helpers';
import { adminLoginSchema } from '@/lib/validators';
import { adminLogin } from '@/server/services/auth.service';
import { setAdminSession, clearCustomerSession } from '@/lib/session';
import type { Role } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, adminLoginSchema);
  if (error) return error;
  try {
    const session = await adminLogin(data.email, data.password);
    await clearCustomerSession(); // role isolation: drop any storefront session
    await setAdminSession({
      userId: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role as Role,
    });
    return ok({ loggedIn: true, role: session.role, fullName: session.fullName });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return fail(err instanceof Error ? err.message : 'Login failed', status);
  }
}
