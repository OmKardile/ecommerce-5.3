// /admin/products/[id] — edit form (stock edits flow through the audited movement path).

import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { ProductForm, type ProductFormInitial } from '@/components/admin/product-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit product · Patel Networks Ops' };

export default async function AdminProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, brands] = await Promise.all([
    db.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        brand: { select: { name: true } },
        variants: { include: { sku: { include: { inventory: true } } }, orderBy: { sortOrder: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    }),
    db.category.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } }),
    db.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();

  // specifications stored as a JSON object map (seed) — normalize to key/value rows
  let specRows: { key: string; value: string }[] = [];
  if (product.specifications) {
    try {
      const parsed = JSON.parse(product.specifications) as unknown;
      if (Array.isArray(parsed)) {
        specRows = (parsed as { key: string; value: string }[]).map((s) => ({ key: String(s.key ?? ''), value: String(s.value ?? '') }));
      } else if (parsed && typeof parsed === 'object') {
        specRows = Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({ key, value: String(value) }));
      }
    } catch {
      specRows = [];
    }
  }

  const initial: ProductFormInitial = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brandId: product.brandId,
    categoryId: product.categoryId,
    shortDesc: product.shortDesc ?? '',
    description: product.description,
    modelNumber: product.modelNumber ?? '',
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isCodAllowed: product.isCodAllowed,
    warrantyMonths: String(product.warrantyMonths),
    specifications: specRows,
    images: product.images.map((i) => ({ url: i.url, altText: i.altText ?? '' })),
    variants: product.variants.map((v) => ({
      id: v.id,
      name: v.name,
      attributes: (() => {
        try {
          const attrs = JSON.parse(v.attributes) as Record<string, unknown>;
          return Object.entries(attrs).map(([key, value]) => ({ key, value: String(value) }));
        } catch {
          return [];
        }
      })(),
      skuCode: v.sku.code,
      barcode: v.sku.barcode ?? '',
      mrpRupees: (v.sku.mrp / 100).toString(),
      sellingRupees: (v.sku.sellingPrice / 100).toString(),
      weightGrams: String(v.sku.weightGrams),
      stock: String(v.sku.inventory?.currentStock ?? 0),
      lowStockThreshold: String(v.sku.inventory?.lowStockThreshold ?? 5),
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Catalog · {product.brand.name}</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">{product.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Slug <span className="font-mono">/{product.slug}</span> · Editing stock books audited PURCHASE_RECEIPT / MANUAL_ADJUSTMENT movements.
        </p>
      </div>
      <ProductForm categories={categories} brands={brands} initial={initial} />
    </div>
  );
}
