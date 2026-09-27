// /api/admin/banners/[id] — PATCH (edit / active toggle) + DELETE.

import { db } from '@/lib/db';
import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { adminBannerSchema } from '@/lib/validators';
import { recordAudit } from '@/server/services/notification.service';


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('banners');
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const { data, error } = await parseBody(req, adminBannerSchema.partial());
  if (error) return error;

  const existing = await db.banner.findUnique({ where: { id } });
  if (!existing) return fail('Banner not found', 404);

  const banner = await db.banner.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.subtitle !== undefined ? { subtitle: data.subtitle || null } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      ...(data.linkUrl !== undefined ? { linkUrl: data.linkUrl || null } : {}),
      ...(data.placement !== undefined ? { placement: data.placement } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
  await recordAudit('BANNER_UPDATED', 'BANNER', id, { fields: Object.keys(data) }, session.userId);
  return ok({ banner });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('banners');
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const existing = await db.banner.findUnique({ where: { id } });
  if (!existing) return fail('Banner not found', 404);

  await db.banner.delete({ where: { id } });
  await recordAudit('BANNER_DELETED', 'BANNER', id, { title: existing.title }, session.userId);
  return ok({ deleted: true });
}
