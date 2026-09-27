// /api/admin/products — GET list (admin view) + POST create (product + images + variants/SKUs
// + inventory seed with audited PURCHASE_RECEIPT movements). ADMIN / SUPER_ADMIN for writes.

import { db } from '@/lib/db';
import { fail, ok, parseBody, requirePermission } from '@/lib/api-helpers';
import { adminProductSchema } from '@/lib/validators';
import { recordAudit } from '@/server/services/notification.service';


function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function GET() {
  const session = await requirePermission('products');
  if (!session) return fail('Unauthorized', 401);

  const products = await db.product.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      brand: { select: { name: true, slug: true } },
      category: { select: { name: true, slug: true } },
      variants: { include: { sku: { include: { inventory: true } } } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
  });
  return ok({ products });
}

export async function POST(req: Request) {
  const session = await requirePermission('products');
  if (!session) return fail('Unauthorized', 401);

  const { data, error } = await parseBody(req, adminProductSchema);
  if (error) return error;

  const slug = data.slug && data.slug.length > 0 ? data.slug : slugify(data.name);
  const specMap = Object.fromEntries(data.specifications.map((s) => [s.key, s.value]));
  const images = data.images.filter((i) => i.url && i.url.length > 0);

  try {
    const product = await db.$transaction(
      async (tx) => {
        const created = await tx.product.create({
          data: {
            name: data.name,
            slug,
            brandId: data.brandId,
            categoryId: data.categoryId,
            shortDesc: data.shortDesc || null,
            description: data.description,
            modelNumber: data.modelNumber || null,
            isActive: data.isActive,
            isFeatured: data.isFeatured,
            isCodAllowed: data.isCodAllowed,
            warrantyMonths: data.warrantyMonths,
            specifications: JSON.stringify(specMap),
            images: {
              create: images.map((img, idx) => ({ url: img.url, altText: img.altText || null, sortOrder: idx })),
            },
          },
        });
        for (const v of data.variants) {
          const sku = await tx.sku.create({
            data: {
              code: v.sku.code,
              barcode: v.sku.barcode || null,
              mrp: v.sku.mrp,
              sellingPrice: v.sku.sellingPrice,
              weightGrams: v.sku.weightGrams ?? 500,
            },
          });
          await tx.productVariant.create({
            data: { productId: created.id, name: v.name, attributes: JSON.stringify(v.attributes), skuId: sku.id },
          });
          await tx.inventory.create({
            data: { skuId: sku.id, currentStock: v.sku.stock ?? 0, lowStockThreshold: v.sku.lowStockThreshold ?? 5 },
          });
          if ((v.sku.stock ?? 0) > 0) {
            await tx.inventoryMovement.create({
              data: { skuId: sku.id, quantity: v.sku.stock ?? 0, reason: 'PURCHASE_RECEIPT', notes: 'Initial stock on product create', createdById: session.userId },
            });
          }
        }
        return tx.product.findUniqueOrThrow({ where: { id: created.id }, include: { variants: { include: { sku: true } }, images: true } });
      },
      { maxWait: 15000, timeout: 30000 }
    );
    await recordAudit('PRODUCT_CREATED', 'PRODUCT', product.id, { name: data.name, slug, variants: data.variants.length }, session.userId);
    return ok({ product }, 201);
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return fail('A product with that slug, or a SKU/barcode code, already exists', 409);
    }
    console.error('[api/admin/products] create failed', err);
    return fail('Failed to create product', 500);
  }
}
