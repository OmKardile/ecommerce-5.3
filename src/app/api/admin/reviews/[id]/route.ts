// PATCH /api/admin/reviews/[id] — approve or un-approve a customer review.
// DELETE /api/admin/reviews/[id] — remove a review outright (spam/abuse).
// Both actions are audit-logged; the PDP only ever renders isApproved rows.

import { fail, ok, parseBody, requireAnyAdmin } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { recordAudit } from '@/server/services/notification.service';
import { z } from 'zod';

const patchSchema = z.object({
  isApproved: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAnyAdmin();
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const { data, error } = await parseBody(req, patchSchema);
  if (error) return error;

  const review = await db.review.findUnique({ where: { id }, select: { id: true, isApproved: true } });
  if (!review) return fail('Review not found', 404);

  const updated = await db.review.update({
    where: { id },
    data: { isApproved: data.isApproved },
    select: { id: true, isApproved: true },
  });

  await recordAudit(
    data.isApproved ? 'REVIEW_APPROVE' : 'REVIEW_UNAPPROVE',
    'Review',
    id,
    { from: review.isApproved, to: data.isApproved },
    session.userId,
  );

  return ok(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAnyAdmin();
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const review = await db.review.findUnique({
    where: { id },
    select: { id: true, title: true, user: { select: { phone: true } } },
  });
  if (!review) return fail('Review not found', 404);

  await db.review.delete({ where: { id } });
  await recordAudit('REVIEW_DELETE', 'Review', id, { title: review.title, userPhone: review.user?.phone ?? null }, session.userId);

  return ok({ id, deleted: true });
}
