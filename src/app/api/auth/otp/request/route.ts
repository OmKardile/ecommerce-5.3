import type { NextRequest } from 'next/server';
import { ok, fail, clientIp, parseBody } from '@/lib/api-helpers';
import { otpRequestSchema } from '@/lib/validators';
import { requestOtp } from '@/server/services/auth.service';

export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, otpRequestSchema);
  if (error) return error;
  try {
    const result = await requestOtp(data.phone, clientIp(req));
    return ok({ sent: true, simulated: result.simulated, expiresInSec: result.expiresInSec });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return fail(err instanceof Error ? err.message : 'Could not send OTP', status);
  }
}
