// /api/admin/coupons — GET list + POST create. CONTENT_MANAGER / ADMIN / SUPER_ADMIN.

import { db } from '@/lib/db';
import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { adminCouponSchema } from '@/lib/validators';
import { recordAudit } from '@/server/services/notification.service';


export async function GET() {
  const session = await requirePermission('coupons');
  if (!session) return fail('Unauthorized', 401);

  const coupons = await db.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  return ok({ coupons });
}

export async function POST(req: Request) {
  const session = await requirePermission('coupons');
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, adminCouponSchema);
  if (error) return error;

  try {
    const coupon = await db.coupon.create({
      data: {
        code: data.code,
        description: data.description || null,
        type: data.type,
        value: data.value,
        minOrderValue: data.minOrderValue ?? null,
        maxDiscountValue: data.maxDiscountValue ?? null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        usageLimit: data.usageLimit ?? null,
        isActive: data.isActive,
      },
    });
    await recordAudit('COUPON_CREATED', 'COUPON', coupon.id, { code: data.code, type: data.type, value: data.value }, session.userId);
    return ok({ coupon }, 201);
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return fail('A coupon with that code already exists', 409);
    console.error('[api/admin/coupons] create failed', err);
    return fail('Failed to create coupon', 500);
  }
}
