// /admin/categories — taxonomy management (Category → Brand → Product → Variant → SKU).

import { db } from '@/lib/db';
import { CategoryManager, type AdminCategoryRow } from '@/components/admin/category-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categories · Patel Networks Ops' };

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: { parent: { select: { name: true } }, _count: { select: { products: true } } },
  });

  const rows: AdminCategoryRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    parentId: c.parentId,
    parentName: c.parent?.name ?? null,
    hsnCode: c.hsnCode,
    gstRate: c.gstRate,
    imageUrl: c.imageUrl,
    isActive: c.isActive,
    productCount: c._count.products,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Catalog</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">HSN codes and GST rates default line-item tax splits at checkout.</p>
      </div>
      <CategoryManager categories={rows} />
    </div>
  );
}
