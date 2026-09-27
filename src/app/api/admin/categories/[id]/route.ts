// /api/admin/categories/[id] — PATCH (edit/toggle) + DELETE (blocked while products attached).

import { db } from '@/lib/db';
import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { adminCategorySchema } from '@/lib/validators';
import { recordAudit } from '@/server/services/notification.service';


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('categories');
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const { data, error } = await parseBody(req, adminCategorySchema.partial());
  if (error) return error;

  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) return fail('Category not found', 404);
  if (data.parentId === id) return fail('A category cannot be its own parent', 400);

  try {
    const category = await db.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined && data.slug.length > 0 ? { slug: data.slug } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId || null } : {}),
        ...(data.hsnCode !== undefined ? { hsnCode: data.hsnCode || existing.hsnCode } : {}),
        ...(data.gstRate !== undefined ? { gstRate: data.gstRate } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    await recordAudit('CATEGORY_UPDATED', 'CATEGORY', id, { fields: Object.keys(data) }, session.userId);
    return ok({ category });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return fail('A category with that slug already exists', 409);
    console.error('[api/admin/categories/[id]] patch failed', err);
    return fail('Failed to update category', 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('categories');
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const products = await db.product.count({ where: { categoryId: id, deletedAt: null } });
  if (products > 0) return fail(`Cannot delete: ${products} product(s) still reference this category`, 409);
  const children = await db.category.count({ where: { parentId: id } });
  if (children > 0) return fail(`Cannot delete: ${children} subcategory(ies) reference this category`, 409);

  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) return fail('Category not found', 404);

  await db.category.delete({ where: { id } });
  await recordAudit('CATEGORY_DELETED', 'CATEGORY', id, { name: existing.name }, session.userId);
  return ok({ deleted: true });
}
