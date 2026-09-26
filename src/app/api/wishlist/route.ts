import { ok, fail } from '@/lib/api-helpers';
import { getCustomerSession } from '@/lib/session';
import { db } from '@/lib/db';
import { getPriceAndRating } from '@/server/services/catalog.service';
import { mapProductCard } from '@/lib/serializers';

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return fail('Login required', 401);
  const wishlist = await db.wishlist.findUnique({
    where: { userId: session.userId },
    include: {
      items: {
        include: {
          product: {
            include: {
              brand: true,
              category: true,
              images: { take: 3, orderBy: { sortOrder: "asc" } },
              variants: { where: { isActive: true }, include: { sku: { include: { inventory: true } } } },
            },
          },
        },
      },
    },
  });
  const products = (wishlist?.items ?? []).map((i) => i.product);
  const enrich = await getPriceAndRating(products.map((p) => p.id));
  return ok({ items: products.map((p) => mapProductCard(p, enrich.minPrice.get(p.id) ?? 0, enrich.ratings.get(p.id))) });
}

export async function POST() {
  const session = await getCustomerSession();
  if (!session) return fail('Login required', 401);
  await db.wishlist.upsert({ where: { userId: session.userId }, update: {}, create: { userId: session.userId } });
  return ok({ ready: true });
}
