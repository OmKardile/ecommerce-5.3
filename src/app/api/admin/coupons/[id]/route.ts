// /api/admin/coupons/[id] — PATCH (edit / active toggle) + DELETE.

import { db } from '@/lib/db';
import { fail, ok, parseBody, requireRole } from '@/lib/api-helpers';
import { adminCouponSchema } from '@/lib/validators';
import { ROLES } from '@/lib/constants';
import { recordAudit } from '@/server/services/notification.service';

const CONTENT_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CONTENT_MANAGER];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(CONTENT_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const { data, error } = await parseBody(req, adminCouponSchema.partial());
  if (error) return error;

  const existing = await db.coupon.findUnique({ where: { id } });
  if (!existing) return fail('Coupon not found', 404);

  try {
    const coupon = await db.coupon.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.value !== undefined ? { value: data.value } : {}),
        ...(data.minOrderValue !== undefined ? { minOrderValue: data.minOrderValue ?? null } : {}),
        ...(data.maxDiscountValue !== undefined ? { maxDiscountValue: data.maxDiscountValue ?? null } : {}),
        ...(data.startsAt !== undefined ? { startsAt: data.startsAt ? new Date(data.startsAt) : null } : {}),
        ...(data.endsAt !== undefined ? { endsAt: data.endsAt ? new Date(data.endsAt) : null } : {}),
        ...(data.usageLimit !== undefined ? { usageLimit: data.usageLimit ?? null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await recordAudit('COUPON_UPDATED', 'COUPON', id, { fields: Object.keys(data) }, session.userId);
    return ok({ coupon });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return fail('A coupon with that code already exists', 409);
    console.error('[api/admin/coupons/[id]] patch failed', err);
    return fail('Failed to update coupon', 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(CONTENT_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const redemptions = await db.couponRedemption.count({ where: { couponId: id } });
  if (redemptions > 0) {
    // Preserve redemption history — deactivate instead of hard delete.
    await db.coupon.update({ where: { id }, data: { isActive: false } });
    await recordAudit('COUPON_DEACTIVATED_HAS_REDEMPTIONS', 'COUPON', id, { redemptions }, session.userId);
    return ok({ deactivated: true, redemptions });
  }

  const existing = await db.coupon.findUnique({ where: { id } });
  if (!existing) return fail('Coupon not found', 404);
  await db.coupon.delete({ where: { id } });
  await recordAudit('COUPON_DELETED', 'COUPON', id, { code: existing.code }, session.userId);
  return ok({ deleted: true });
}
