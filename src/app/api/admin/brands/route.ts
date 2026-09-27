// /api/admin/brands — GET list + POST create. ADMIN / SUPER_ADMIN for writes.

import { db } from '@/lib/db';
import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { adminBrandSchema } from '@/lib/validators';
import { recordAudit } from '@/server/services/notification.service';


function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function GET() {
  const session = await requirePermission('brands');
  if (!session) return fail('Unauthorized', 401);

  const brands = await db.brand.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  return ok({ brands });
}

export async function POST(req: Request) {
  const session = await requirePermission('brands');
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, adminBrandSchema);
  if (error) return error;

  try {
    const brand = await db.brand.create({
      data: {
        name: data.name,
        slug: data.slug && data.slug.length > 0 ? data.slug : slugify(data.name),
        logoUrl: data.logoUrl || null,
        description: data.description || null,
        isActive: data.isActive ?? true,
      },
    });
    await recordAudit('BRAND_CREATED', 'BRAND', brand.id, { name: data.name, slug: brand.slug }, session.userId);
    return ok({ brand }, 201);
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return fail('A brand with that slug already exists', 409);
    console.error('[api/admin/brands] create failed', err);
    return fail('Failed to create brand', 500);
  }
}
