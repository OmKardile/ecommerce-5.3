// /api/admin/categories — GET tree/list + POST create. ADMIN / SUPER_ADMIN for writes.

import { db } from '@/lib/db';
import { fail, ok, parseBody, requireAnyAdmin, requireRole } from '@/lib/api-helpers';
import { adminCategorySchema } from '@/lib/validators';
import { ROLES } from '@/lib/constants';
import { recordAudit } from '@/server/services/notification.service';

const CATALOG_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function GET() {
  const session = await requireAnyAdmin();
  if (!session) return fail('Unauthorized', 401);

  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { parent: { select: { id: true, name: true } }, _count: { select: { products: true } } },
  });
  return ok({ categories });
}

export async function POST(req: Request) {
  const session = await requireRole(CATALOG_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, adminCategorySchema);
  if (error) return error;

  try {
    const category = await db.category.create({
      data: {
        name: data.name,
        slug: data.slug && data.slug.length > 0 ? data.slug : slugify(data.name),
        description: data.description || null,
        parentId: data.parentId || null,
        hsnCode: data.hsnCode || '8525',
        gstRate: data.gstRate ?? 18,
        imageUrl: data.imageUrl || null,
        isActive: data.isActive ?? true,
      },
    });
    await recordAudit('CATEGORY_CREATED', 'CATEGORY', category.id, { name: data.name, slug: category.slug }, session.userId);
    return ok({ category }, 201);
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return fail('A category with that slug already exists', 409);
    if (err instanceof Error && err.message.includes('Invalid `parentId`')) return fail('Parent category not found', 400);
    console.error('[api/admin/categories] create failed', err);
    return fail('Failed to create category', 500);
  }
}
