import type { NextRequest } from 'next/server';
import { ok, fail, parseBody } from '@/lib/api-helpers';
import { otpVerifySchema } from '@/lib/validators';
import { verifyOtpAndLogin } from '@/server/services/auth.service';
import { setCustomerSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, otpVerifySchema);
  if (error) return error;
  try {
    const result = await verifyOtpAndLogin(data.phone, data.code, data.fullName);
    await setCustomerSession({ userId: result.userId, customerId: result.customerId, phone: result.phone, role: 'CUSTOMER' });
    return ok({ loggedIn: true, isNewUser: result.isNewUser, mergedCartItems: result.mergedCartItems, phone: result.phone });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return fail(err instanceof Error ? err.message : 'Verification failed', status);
  }
}
