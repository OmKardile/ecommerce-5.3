// /admin/brands — brand directory management.

import { db } from '@/lib/db';
import { BrandManager, type AdminBrandRow } from '@/components/admin/brand-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Brands · Patel Networks Ops' };

export default async function AdminBrandsPage() {
  const brands = await db.brand.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  const rows: AdminBrandRow[] = brands.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    logoUrl: b.logoUrl,
    description: b.description,
    isActive: b.isActive,
    productCount: b._count.products,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Catalog</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Brands</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hikvision, Dahua, CP Plus and the rest of the documented brand list.</p>
      </div>
      <BrandManager brands={rows} />
    </div>
  );
}
