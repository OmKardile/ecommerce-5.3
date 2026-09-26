// /api/admin/brands/[id] — PATCH (edit/toggle) + DELETE (blocked while products attached).

import { db } from '@/lib/db';
import { fail, ok, parseBody, requireRole } from '@/lib/api-helpers';
import { adminBrandSchema } from '@/lib/validators';
import { ROLES } from '@/lib/constants';
import { recordAudit } from '@/server/services/notification.service';

const CATALOG_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(CATALOG_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const { data, error } = await parseBody(req, adminBrandSchema.partial());
  if (error) return error;

  const existing = await db.brand.findUnique({ where: { id } });
  if (!existing) return fail('Brand not found', 404);

  try {
    const brand = await db.brand.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined && data.slug.length > 0 ? { slug: data.slug } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl || null } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await recordAudit('BRAND_UPDATED', 'BRAND', id, { fields: Object.keys(data) }, session.userId);
    return ok({ brand });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return fail('A brand with that slug already exists', 409);
    console.error('[api/admin/brands/[id]] patch failed', err);
    return fail('Failed to update brand', 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(CATALOG_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const products = await db.product.count({ where: { brandId: id, deletedAt: null } });
  if (products > 0) return fail(`Cannot delete: ${products} product(s) still reference this brand`, 409);

  const existing = await db.brand.findUnique({ where: { id } });
  if (!existing) return fail('Brand not found', 404);

  await db.brand.delete({ where: { id } });
  await recordAudit('BRAND_DELETED', 'BRAND', id, { name: existing.name }, session.userId);
  return ok({ deleted: true });
}
