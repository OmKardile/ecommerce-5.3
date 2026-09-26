// Coupon service — server-side validation only (never trust client math).

import { db } from '@/lib/db';
import type { Coupon } from '@prisma/client';

export interface CouponEvaluation {
  valid: boolean;
  reason?: string;
  discountPaise: number;
  coupon?: Pick<Coupon, 'id' | 'code' | 'type' | 'value' | 'maxDiscountValue'>;
}

export async function evaluateCoupon(code: string, subtotalPaise: number): Promise<CouponEvaluation> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false, reason: 'Enter a coupon code', discountPaise: 0 };
  const coupon = await db.coupon.findUnique({ where: { code: normalized } });
  if (!coupon || !coupon.isActive) return { valid: false, reason: 'Invalid or expired coupon', discountPaise: 0 };
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { valid: false, reason: 'This coupon is not active yet', discountPaise: 0 };
  if (coupon.endsAt && coupon.endsAt < now) return { valid: false, reason: 'This coupon has expired', discountPaise: 0 };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, reason: 'This coupon has reached its usage limit', discountPaise: 0 };
  }
  if (coupon.minOrderValue !== null && subtotalPaise < coupon.minOrderValue) {
    return { valid: false, reason: `Minimum order value not met`, discountPaise: 0 };
  }

  let discount =
    coupon.type === 'PERCENT'
      ? Math.round((subtotalPaise * coupon.value) / 100)
      : coupon.value;
  if (coupon.maxDiscountValue !== null) discount = Math.min(discount, coupon.maxDiscountValue);
  discount = Math.min(discount, subtotalPaise);
  if (discount <= 0) return { valid: false, reason: 'Coupon does not apply to this cart', discountPaise: 0 };

  return {
    valid: true,
    discountPaise: discount,
    coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value, maxDiscountValue: coupon.maxDiscountValue },
  };
}

export async function recordRedemption(couponId: string, orderId: string, discountPaise: number): Promise<void> {
  await db.$transaction([
    db.couponRedemption.create({ data: { couponId, orderId, discountAmount: discountPaise } }),
    db.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } }),
  ]);
}

export async function reverseRedemption(couponId: string, orderId: string): Promise<void> {
  const redemption = await db.couponRedemption.findUnique({ where: { couponId_orderId: { couponId, orderId } } });
  if (!redemption) return;
  await db.$transaction([
    db.couponRedemption.delete({ where: { id: redemption.id } }),
    db.coupon.update({ where: { id: couponId }, data: { usedCount: { decrement: 1 } } }),
  ]);
}
