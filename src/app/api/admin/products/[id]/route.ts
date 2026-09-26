// /api/admin/products/[id] — GET (edit payload), PATCH (toggle or full update — stock edits
// are diffed and routed through the audited adjustStock path), DELETE (soft delete).
// ADMIN / SUPER_ADMIN for writes.

import { db } from '@/lib/db';
import { fail, ok, parseBody, requireAnyAdmin, requireRole } from '@/lib/api-helpers';
import { adminProductSchema } from '@/lib/validators';
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAnyAdmin();
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const product = await db.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      variants: { include: { sku: { include: { inventory: true } } }, orderBy: { sortOrder: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!product) return fail('Product not found', 404);
  return ok({ product });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(CATALOG_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const { data, error } = await parseBody(req, adminProductSchema.partial());
  if (error) return error;

  const existing = await db.product.findFirst({ where: { id, deletedAt: null }, include: { variants: { include: { sku: { include: { inventory: true } } } } } });
  if (!existing) return fail('Product not found', 404);

  const isToggleOnly = data.variants === undefined && data.images === undefined && Object.keys(data).every((k) => ['isActive', 'isCodAllowed', 'isFeatured'].includes(k));

  try {
    const product = await db.$transaction(
      async (tx) => {
        const productData: Record<string, unknown> = {};
        if (data.name !== undefined) {
          productData.name = data.name;
          if (data.slug === undefined) productData.slug = slugify(data.name);
        }
        if (data.slug !== undefined) productData.slug = data.slug;
        if (data.brandId !== undefined) productData.brandId = data.brandId;
        if (data.categoryId !== undefined) productData.categoryId = data.categoryId;
        if (data.shortDesc !== undefined) productData.shortDesc = data.shortDesc || null;
        if (data.description !== undefined) productData.description = data.description;
        if (data.modelNumber !== undefined) productData.modelNumber = data.modelNumber || null;
        if (data.isActive !== undefined) productData.isActive = data.isActive;
        if (data.isFeatured !== undefined) productData.isFeatured = data.isFeatured;
        if (data.isCodAllowed !== undefined) productData.isCodAllowed = data.isCodAllowed;
        if (data.warrantyMonths !== undefined) productData.warrantyMonths = data.warrantyMonths;
        if (data.specifications !== undefined) {
          productData.specifications = JSON.stringify(Object.fromEntries(data.specifications.map((s) => [s.key, s.value])));
        }
        if (Object.keys(productData).length > 0) {
          await tx.product.update({ where: { id }, data: productData });
        }

        if (data.images !== undefined) {
          await tx.productImage.deleteMany({ where: { productId: id } });
          const images = data.images.filter((i) => i.url && i.url.length > 0);
          for (let idx = 0; idx < images.length; idx++) {
            await tx.productImage.create({ data: { productId: id, url: images[idx].url, altText: images[idx].altText || null, sortOrder: idx } });
          }
        }

        if (data.variants !== undefined) {
          for (const v of data.variants) {
            if (v.id) {
              const existingVariant = await tx.productVariant.findFirst({ where: { id: v.id, productId: id }, include: { sku: { include: { inventory: true } } } });
              if (!existingVariant) continue;
              await tx.productVariant.update({
                where: { id: existingVariant.id },
                data: { name: v.name, attributes: JSON.stringify(v.attributes) },
              });
              await tx.sku.update({
                where: { id: existingVariant.skuId },
                data: {
                  code: v.sku.code,
                  barcode: v.sku.barcode || null,
                  mrp: v.sku.mrp,
                  sellingPrice: v.sku.sellingPrice,
                  weightGrams: v.sku.weightGrams ?? existingVariant.sku.weightGrams,
                },
              });
              // Stock edits go through the audited movement path (delta = new - old).
              const inv = existingVariant.sku.inventory;
              const currentStock = inv?.currentStock ?? 0;
              const delta = (v.sku.stock ?? currentStock) - currentStock;
              if (delta !== 0 && inv) {
                const reason = delta > 0 ? 'PURCHASE_RECEIPT' : 'MANUAL_ADJUSTMENT';
                if (reason === 'MANUAL_ADJUSTMENT' && currentStock + delta < (inv.reservedStock ?? 0)) {
                  throw new Error(`Cannot reduce stock of ${v.sku.code} below reserved units (${inv.reservedStock})`);
                }
                await tx.inventory.update({ where: { skuId: inv.skuId }, data: { currentStock: currentStock + delta, lowStockThreshold: v.sku.lowStockThreshold ?? inv.lowStockThreshold } });
                await tx.inventoryMovement.create({
                  data: { skuId: inv.skuId, quantity: delta, reason, notes: 'Stock edit on admin product form', createdById: session.userId },
                });
              } else if (inv && v.sku.lowStockThreshold !== undefined) {
                await tx.inventory.update({ where: { skuId: inv.skuId }, data: { lowStockThreshold: v.sku.lowStockThreshold } });
              }
            } else {
              // New variant/SKU — seed inventory directly.
              const sku = await tx.sku.create({
                data: {
                  code: v.sku.code,
                  barcode: v.sku.barcode || null,
                  mrp: v.sku.mrp,
                  sellingPrice: v.sku.sellingPrice,
                  weightGrams: v.sku.weightGrams ?? 500,
                },
              });
              await tx.productVariant.create({ data: { productId: id, name: v.name, attributes: JSON.stringify(v.attributes), skuId: sku.id } });
              await tx.inventory.create({ data: { skuId: sku.id, currentStock: v.sku.stock ?? 0, lowStockThreshold: v.sku.lowStockThreshold ?? 5 } });
              if ((v.sku.stock ?? 0) > 0) {
                await tx.inventoryMovement.create({
                  data: { skuId: sku.id, quantity: v.sku.stock ?? 0, reason: 'PURCHASE_RECEIPT', notes: 'Initial stock on variant add', createdById: session.userId },
                });
              }
            }
          }
        }

        return tx.product.findUniqueOrThrow({ where: { id }, include: { variants: { include: { sku: { include: { inventory: true } } } }, images: true } });
      },
      { maxWait: 15000, timeout: 30000 }
    );

    await recordAudit(isToggleOnly ? 'PRODUCT_FLAG_TOGGLED' : 'PRODUCT_UPDATED', 'PRODUCT', id, { fields: Object.keys(data) }, session.userId);
    return ok({ product });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      return fail('Slug, SKU or barcode already in use by another record', 409);
    }
    if (err instanceof Error && err.message.includes('below reserved')) return fail(err.message, 409);
    console.error('[api/admin/products/[id]] patch failed', err);
    return fail('Failed to update product', 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(CATALOG_ROLES);
  if (!session) return fail('Unauthorized', 401);

  const { id } = await params;
  const existing = await db.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return fail('Product not found', 404);

  await db.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await recordAudit('PRODUCT_ARCHIVED', 'PRODUCT', id, { name: existing.name }, session.userId);
  return ok({ archived: true });
}
