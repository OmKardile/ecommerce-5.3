// Wishlist service — server-side state for the wishlist toggles.
// Kept tiny: the API routes own mutations; pages only read membership.

import { db } from '@/lib/db';

/** Set of productIds on the user's wishlist. Empty set when signed out. */
export async function getWishlistProductIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const wishlist = await db.wishlist.findUnique({
    where: { userId },
    select: { items: { select: { productId: true } } },
  });
  return new Set((wishlist?.items ?? []).map((i) => i.productId));
}

export async function isProductWishlisted(userId: string | null, productId: string): Promise<boolean> {
  if (!userId) return false;
  const wishlist = await db.wishlist.findUnique({
    where: { userId },
    select: { items: { where: { productId }, select: { id: true } } },
  });
  return (wishlist?.items.length ?? 0) > 0;
}
