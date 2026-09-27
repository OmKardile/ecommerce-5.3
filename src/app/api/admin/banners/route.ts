// /api/admin/banners — GET list + POST create. CONTENT_MANAGER / ADMIN / SUPER_ADMIN.

import { db } from '@/lib/db';
import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { adminBannerSchema } from '@/lib/validators';
import { recordAudit } from '@/server/services/notification.service';


export async function GET() {
  const session = await requirePermission('banners');
  if (!session) return fail('Unauthorized', 401);

  const banners = await db.banner.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  return ok({ banners });
}

export async function POST(req: Request) {
  const session = await requirePermission('banners');
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, adminBannerSchema);
  if (error) return error;

  try {
    const banner = await db.banner.create({
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl || null,
        placement: data.placement,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
    });
    await recordAudit('BANNER_CREATED', 'BANNER', banner.id, { title: data.title, placement: data.placement }, session.userId);
    return ok({ banner }, 201);
  } catch (err) {
    console.error('[api/admin/banners] create failed', err);
    return fail('Failed to create banner', 500);
  }
}
