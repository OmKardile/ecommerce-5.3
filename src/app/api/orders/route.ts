import type { NextRequest } from 'next/server';
import { ok, fail, parseBody } from '@/lib/api-helpers';
import { checkoutSchema } from '@/lib/validators';
import { getCustomerSession } from '@/lib/session';
import { createOrderFromCart } from '@/server/services/order.service';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return fail('Login required to place an order', 401);
  const rl = rateLimit(`checkout:${clientIp(req)}`, 10, 60 * 1000);
  if (!rl.ok) return fail('Too many attempts, please wait a moment', 429);

  const { data, error } = await parseBody(req, checkoutSchema);
  if (error) return error;

  try {
    const result = await createOrderFromCart(session.userId, data);
    return ok(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const code = (err as { code?: string }).code ?? 'ORDER_ERROR';
    return fail(err instanceof Error ? err.message : 'Could not place order', status, { code });
  }
}
