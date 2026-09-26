import type { NextRequest } from 'next/server';
import { ok } from '@/lib/api-helpers';
import { productQuerySchema } from '@/lib/validators';
import { listProducts, getPriceAndRating } from '@/server/services/catalog.service';
import { mapProductCard } from '@/lib/serializers';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = productQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return ok({ items: [], total: 0, page: 1, perPage: 12, totalPages: 1 });
  const result = await listProducts(parsed.data);
  const enrich = await getPriceAndRating(result.items.map((p) => p.id));
  return ok({
    ...result,
    items: result.items.map((p) => mapProductCard(p, enrich.minPrice.get(p.id) ?? 0, enrich.ratings.get(p.id))),
  });
}
