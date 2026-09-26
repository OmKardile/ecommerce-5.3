import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helpers';
import { getCustomerSession } from '@/lib/session';
import { verifyCheckoutSignature } from '@/server/services/payment.service';

export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return fail('Login required', 401);
  const body = (await req.json()) as { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
    return fail('Missing payment verification fields', 400);
  }
  const result = await verifyCheckoutSignature({
    gatewayOrderId: body.razorpay_order_id,
    gatewayPaymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });
  if (!result.verified) return fail('Payment verification failed', 400);
  return ok(result);
}
