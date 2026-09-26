// /admin/products — catalog table (server-loaded, client interactions).

import { db } from '@/lib/db';
import { ProductsTable, type AdminProductRow } from '@/components/admin/products-table';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Products · Patel Networks Ops' };

export default async function AdminProductsPage() {
  const products = await db.product.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      variants: { include: { sku: { include: { inventory: true } } } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
    },
  });

  const rows: AdminProductRow[] = products.map((p) => {
    const prices = p.variants.map((v) => v.sku.sellingPrice);
    const stock = p.variants.reduce((n, v) => n + (v.sku.inventory?.currentStock ?? 0), 0);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      brandName: p.brand.name,
      categoryName: p.category.name,
      isActive: p.isActive,
      isCodAllowed: p.isCodAllowed,
      isFeatured: p.isFeatured,
      variantsCount: p.variants.length,
      priceFromPaise: prices.length ? Math.min(...prices) : 0,
      stockTotal: stock,
      imageUrl: p.images[0]?.url ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Catalog</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Multi-attribute variants resolve to discrete SKUs (ADR-005). Stock lives only at SKU level.
        </p>
      </div>
      <ProductsTable products={rows} />
    </div>
  );
}
