// /admin/products/new — create form (server shell supplies category/brand pickers).

import { db } from '@/lib/db';
import { ProductForm } from '@/components/admin/product-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New product · Patel Networks Ops' };

export default async function AdminProductNewPage() {
  const [categories, brands] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
    db.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Catalog</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">New product</h1>
        <p className="mt-1 text-sm text-muted-foreground">Prices are GST-inclusive; initial stock is booked as a PURCHASE_RECEIPT movement.</p>
      </div>
      <ProductForm categories={categories} brands={brands} />
    </div>
  );
}
