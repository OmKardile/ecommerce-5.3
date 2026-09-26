// PATCH /api/orders/[orderNumber]/address — customer self-service delivery
// address edit. Owner only; allowed while the order is pre-pack
// (PENDING_PAYMENT … PROCESSING). PIN code & state are immutable — they drive
// the shipping zone, COD eligibility and the GST split already on the invoice.

import { fail, ok } from '@/lib/api-helpers';
import { getCustomerSession } from '@/lib/session';
import { orderAddressUpdateSchema } from '@/lib/validators';
import { updateDeliveryAddressByCustomer } from '@/server/services/order.service';

export async function PATCH(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const session = await getCustomerSession();
  if (!session) return fail('Sign in to manage your orders', 401);

  const { orderNumber } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid request body', 400);
  }

  const parsed = orderAddressUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first?.message ?? 'Check the address fields and try again', 400);
  }

  try {
    const result = await updateDeliveryAddressByCustomer(decodeURIComponent(orderNumber), session.userId, parsed.data);
    if (!result.ok) return fail(result.error, result.status ?? 400);
    return ok({ updated: true, status: result.status });
  } catch (err) {
    console.error('[api/orders/address] failed', err);
    return fail('Could not update the delivery address. Try again or contact the trade desk.', 500);
  }
}
