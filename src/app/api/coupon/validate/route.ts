import type { NextRequest } from 'next/server';
import { ok, parseBody } from '@/lib/api-helpers';
import { couponValidateSchema } from '@/lib/validators';
import { evaluateCoupon } from '@/server/services/coupon.service';

export async function POST(req: NextRequest) {
  const { data, error } = await parseBody(req, couponValidateSchema);
  if (error) return error;
  const result = await evaluateCoupon(data.code, data.subtotalPaise);
  return ok(result);
}
