// Shared API serializers — stable storefront-facing product shapes.
// Accepts the Prisma product-with-relations shape loosely (include sets vary by call site).

import { discountPercent } from "@/lib/money";

export interface ApiProductVariant {
  id: string;
  name: string;
  attributes: Record<string, string>;
  skuId: string;
  skuCode: string;
  mrpPaise: number;
  sellingPricePaise: number;
  discountPct: number;
  availableStock: number;
  inStock: boolean;
  lowStock: boolean;
  weightGrams: number;
}

export interface ApiProductCard {
  id: string;
  slug: string;
  name: string;
  shortDesc: string | null;
  modelNumber: string | null;
  isCodAllowed: boolean;
  warrantyMonths: number;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  images: { url: string; alt: string | null }[];
  priceFromPaise: number;
  mrpFromPaise: number;
  discountPct: number;
  availableStock: number;
  inStock: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  variants: ApiProductVariant[];
  attributes: string[];
}

interface ProductLike {
  id: string;
  slug: string;
  name: string;
  shortDesc: string | null;
  modelNumber: string | null;
  isCodAllowed: boolean;
  warrantyMonths: number;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  images: { url: string; altText: string | null }[];
  variants: {
    id: string;
    name: string;
    attributes: string;
    skuId: string;
    sku: {
      code: string;
      mrp: number;
      sellingPrice: number;
      weightGrams: number;
      inventory: { currentStock: number; reservedStock: number; lowStockThreshold: number } | null;
    };
  }[];
  _count?: { reviews: number } | undefined;
}

function parseAttributes(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
  } catch {
    return {};
  }
}

export function mapProductCard(
  p: ProductLike,
  priceFromPaise: number,
  rating?: { avg: number; count: number }
): ApiProductCard {
  const variants: ApiProductVariant[] = p.variants.map((v) => {
    const available = v.sku.inventory ? Math.max(v.sku.inventory.currentStock - v.sku.inventory.reservedStock, 0) : 0;
    return {
      id: v.id,
      name: v.name,
      attributes: parseAttributes(v.attributes),
      skuId: v.skuId,
      skuCode: v.sku.code,
      mrpPaise: v.sku.mrp,
      sellingPricePaise: v.sku.sellingPrice,
      discountPct: discountPercent(v.sku.sellingPrice, v.sku.mrp),
      availableStock: available,
      inStock: available > 0,
      lowStock: available > 0 && available <= (v.sku.inventory?.lowStockThreshold ?? 5),
      weightGrams: v.sku.weightGrams,
    };
  });

  const prices = variants.map((v) => v.sellingPricePaise).filter((n) => n > 0);
  const mrps = variants.map((v) => v.mrpPaise).filter((n) => n > 0);
  const priceFrom = priceFromPaise || (prices.length ? Math.min(...prices) : 0);
  const mrpFrom = mrps.length ? Math.min(...mrps) : priceFrom;
  const attributeKeys = [...new Set(variants.flatMap((v) => Object.keys(v.attributes)))];

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDesc: p.shortDesc,
    modelNumber: p.modelNumber,
    isCodAllowed: p.isCodAllowed,
    warrantyMonths: p.warrantyMonths,
    brand: p.brand,
    category: p.category,
    images: p.images.map((i) => ({ url: i.url, alt: i.altText })),
    priceFromPaise: priceFrom,
    mrpFromPaise: mrpFrom,
    discountPct: discountPercent(priceFrom, mrpFrom),
    availableStock: variants.reduce((n, v) => n + v.availableStock, 0),
    inStock: variants.some((v) => v.inStock),
    ratingAvg: rating?.avg ?? null,
    ratingCount: rating?.count ?? 0,
    variants,
    attributes: attributeKeys,
  };
}
