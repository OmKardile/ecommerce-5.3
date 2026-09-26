// Catalog service — product discovery, search, facets, PDP data. Zero-trust: prices always from DB.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import type { ProductQueryInput } from '@/lib/validators';

const productCardInclude = {
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { sortOrder: 'asc' as const }, take: 3 },
  variants: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      sku: { include: { inventory: { select: { currentStock: true, reservedStock: true, lowStockThreshold: true } } } },
    },
  },
  _count: { select: { reviews: { where: { isApproved: true } } } },
} satisfies Prisma.ProductInclude;

export type ProductCard = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

export interface CatalogResult {
  items: ProductCard[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listProducts(query: ProductQueryInput): Promise<CatalogResult> {
  const and: Prisma.ProductWhereInput[] = [{ isActive: true, deletedAt: null }];

  if (query.q) {
    const q = query.q.trim();
    and.push({
      OR: [
        { name: { contains: q } },
        { modelNumber: { contains: q } },
        { brand: { is: { name: { contains: q } } } },
        { category: { is: { name: { contains: q } } } },
        { shortDesc: { contains: q } },
      ],
    });
  }
  if (query.category) {
    const slugs = query.category.split(',').map((s) => s.trim()).filter(Boolean);
    // include products of subcategories matching slugs or their parents
    const cats = await db.category.findMany({
      where: { OR: [{ slug: { in: slugs } }, { parent: { slug: { in: slugs } } }] },
      select: { id: true },
    });
    and.push({ categoryId: { in: cats.map((c) => c.id) } });
  }
  if (query.brand) {
    const slugs = query.brand.split(',').map((s) => s.trim()).filter(Boolean);
    and.push({ brand: { slug: { in: slugs } } });
  }
  if (query.resolution) {
    const res = query.resolution.split(',').map((s) => s.trim()).filter(Boolean);
    if (res.length === 1) {
      and.push({ variants: { some: { attributes: { contains: res[0] } } } });
    } else {
      and.push({ OR: res.map((r) => ({ variants: { some: { attributes: { contains: r } } } })) });
    }
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const min = query.minPrice !== undefined ? query.minPrice * 100 : 0;
    const max = query.maxPrice !== undefined ? query.maxPrice * 100 : Number.MAX_SAFE_INTEGER;
    and.push({ variants: { some: { sku: { sellingPrice: { gte: min, lte: max } } } } });
  }
  if (query.availability === 'in-stock') {
    and.push({ variants: { some: { sku: { inventory: { currentStock: { gt: 0 } } } } } });
  } else if (query.availability === 'out-of-stock') {
    and.push({ variants: { none: { sku: { inventory: { currentStock: { gt: 0 } } } } } });
  }
  if (query.featured) and.push({ isFeatured: true });

  const where: Prisma.ProductWhereInput = { AND: and };

  let ratingFilter = false;
  if (query.minRating !== undefined) {
    // rating filter applied post-query via aggregate (SQLite lacks HAVING on relations)
    ratingFilter = true;
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    query.sort === 'price-asc' || query.sort === 'price-desc'
      ? [{ createdAt: 'desc' }]
      : query.sort === 'newest'
        ? [{ createdAt: 'desc' }]
        : [{ isFeatured: 'desc' }, { createdAt: 'desc' }];

  const page = query.page;
  const perPage = query.perPage;

  let items = await db.product.findMany({
    where,
    include: productCardInclude,
    orderBy,
    skip: ratingFilter ? 0 : (page - 1) * perPage,
    take: ratingFilter ? 400 : perPage,
  });

  if (query.minRating !== undefined) {
    const productIds = items.map((p) => p.id);
    const agg = await db.review.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, isApproved: true },
      _avg: { rating: true },
    });
    const okIds = new Set(agg.filter((a) => (a._avg.rating ?? 0) >= query.minRating!).map((a) => a.productId));
    items = items.filter((p) => okIds.has(p.id));
    const total = items.length;
    return { items: items.slice((page - 1) * perPage, page * perPage), total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
  }

  if (query.sort === 'price-asc' || query.sort === 'price-desc') {
    const price = (p: ProductCard) => Math.min(...p.variants.map((v) => v.sku.sellingPrice), Number.MAX_SAFE_INTEGER);
    items.sort((a, b) => (query.sort === 'price-asc' ? price(a) - price(b) : price(b) - price(a)));
  }

  const total = await db.product.count({ where });
  return { items, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getProductBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    include: {
      ...productCardInclude,
      images: { orderBy: { sortOrder: 'asc' as const } },
      reviews: {
        where: { isApproved: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { fullName: true } } },
      },
    } as Prisma.ProductInclude,
  });
}

export async function getRelatedProducts(productId: string, categoryId: string, take = 4): Promise<ProductCard[]> {
  return db.product.findMany({
    where: { categoryId, isActive: true, deletedAt: null, id: { not: productId } },
    include: productCardInclude,
    take,
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
  });
}

export interface QuickSearchHit {
  id: string;
  slug: string;
  name: string;
  brand: string;
  modelNumber: string | null;
  priceFromPaise: number;
  image: string | null;
}

export async function quickSearch(q: string, take = 8): Promise<QuickSearchHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const products = await db.product.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [
        { name: { contains: term } },
        { modelNumber: { contains: term } },
        { brand: { is: { name: { contains: term } } } },
        { category: { is: { name: { contains: term } } } },
      ],
    },
    include: {
      brand: { select: { name: true } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      variants: { where: { isActive: true }, include: { sku: { select: { sellingPrice: true } } }, take: 10 },
    },
    take,
    orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
  });
  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand.name,
    modelNumber: p.modelNumber,
    priceFromPaise: p.variants.length ? Math.min(...p.variants.map((v) => v.sku.sellingPrice)) : 0,
    image: p.images[0]?.url ?? null,
  }));
}

export interface CategoryFacet {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  children: { id: string; name: string; slug: string }[];
}

export async function getCategoryTree(): Promise<CategoryFacet[]> {
  const roots = await db.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, slug: true } } },
  });
  return roots.map((c) => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl, children: c.children }));
}

export async function getBrands() {
  return db.brand.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: { where: { isActive: true, deletedAt: null } } } } },
  });
}

export async function getBrandBySlug(slug: string) {
  const brand = await db.brand.findUnique({ where: { slug }, include: { _count: { select: { products: { where: { isActive: true, deletedAt: null } } } } } });
  if (!brand) return null;
  const products = await db.product.findMany({
    where: { brandId: brand.id, isActive: true, deletedAt: null },
    include: productCardInclude,
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take: 24,
  });
  return { brand, products };
}

/** Lowest price + aggregate rating for a set of products (single round-trips, no N+1). */
export async function getPriceAndRating(productIds: string[]) {
  if (!productIds.length) return { minPrice: new Map<string, number>(), ratings: new Map<string, { avg: number; count: number }>() };
  const variants = await db.productVariant.findMany({
    where: { productId: { in: productIds }, isActive: true },
    select: { productId: true, sku: { select: { sellingPrice: true } } },
  });
  const minPrice = new Map<string, number>();
  for (const v of variants) {
    const cur = minPrice.get(v.productId);
    if (cur === undefined || v.sku.sellingPrice < cur) minPrice.set(v.productId, v.sku.sellingPrice);
  }
  const agg = await db.review.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds }, isApproved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const ratings = new Map<string, { avg: number; count: number }>();
  for (const a of agg) ratings.set(a.productId, { avg: a._avg.rating ?? 0, count: a._count._all });
  return { minPrice, ratings };
}

/** Approved-review star distribution for one product (5→1 buckets). Powers the PDP summary histogram. */
export async function getRatingDistribution(productId: string): Promise<{ rating: number; count: number }[]> {
  const rows = await db.review.groupBy({
    by: ['rating'],
    where: { productId, isApproved: true },
    _count: { _all: true },
  });
  return [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: rows.find((x) => x.rating === r)?._count._all ?? 0 }));
}

export async function getFeaturedProducts(take = 8): Promise<ProductCard[]> {
  return db.product.findMany({
    where: { isActive: true, deletedAt: null, isFeatured: true },
    include: productCardInclude,
    orderBy: { createdAt: 'desc' },
    take,
  });
}

/** Compare page — fetch up to 4 products by id, preserving the caller's order.
 *  The card include returns all scalar columns, so `specifications` comes along for free. */
export async function getProductsForCompare(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.product.findMany({
    where: { id: { in: ids }, isActive: true, deletedAt: null },
    include: productCardInclude,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is ProductCard => Boolean(r));
}

export async function getNewArrivals(take = 4): Promise<ProductCard[]> {
  return db.product.findMany({
    where: { isActive: true, deletedAt: null },
    include: productCardInclude,
    orderBy: { createdAt: 'desc' },
    take,
  });
}
