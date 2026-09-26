// PATCH /api/admin/inquiries/[id] — move an inquiry through the trade-desk
// pipeline: NEW → CONTACTED → CLOSED (with optional follow-up note).
// Server-side FSM: status must move forward only; NEW→CLOSED is allowed
// (junk/spam). Stamps handledAt the first time the row leaves NEW.

import { fail, ok, parseBody, requireAnyAdmin } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { recordAudit } from '@/server/services/notification.service';
import { z } from 'zod';

const patchSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CLOSED']),
  note: z.string().max(1000).trim().optional(),
});

const RANK: Record<string, number> = { NEW: 0, CONTACTED: 1, CLOSED: 2 };

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAnyAdmin();
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const { data, error } = await parseBody(req, patchSchema);
  if (error) return error;

  const inquiry = await db.b2BInquiry.findUnique({ where: { id } });
  if (!inquiry) return fail('Inquiry not found', 404);

  if (RANK[data.status] < RANK[inquiry.status]) {
    return fail(`Status can only move forward (currently ${inquiry.status.toLowerCase()}).`, 422);
  }

  const updated = await db.b2BInquiry.update({
    where: { id },
    data: {
      status: data.status,
      note: data.note !== undefined ? data.note || null : undefined,
      handledAt: inquiry.status === 'NEW' && data.status !== 'NEW' ? new Date() : inquiry.handledAt,
    },
  });

  await recordAudit(
    'INQUIRY_STATUS',
    'B2BInquiry',
    id,
    { from: inquiry.status, to: data.status, note: data.note ?? null },
    session.userId,
  );

  return ok({
    id: updated.id,
    status: updated.status,
    note: updated.note,
    handledAt: updated.handledAt?.toISOString() ?? null,
  });
}
