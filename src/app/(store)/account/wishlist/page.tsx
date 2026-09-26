import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HeartCrack } from "lucide-react";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getPriceAndRating } from "@/server/services/catalog.service";
import { mapProductCard, type ApiProductCard } from "@/lib/serializers";
import { formatINR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { WishlistActions } from "@/components/storefront/account-wishlist-actions";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Hardware you have saved for the next installation.",
};

export default async function AccountWishlistPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login?next=%2Faccount%2Fwishlist");

  const wishlist = await db.wishlist.findUnique({
    where: { userId: session.userId },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
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
  const cards: ApiProductCard[] = products.map((p) => mapProductCard(p, enrich.minPrice.get(p.id) ?? 0, enrich.ratings.get(p.id)));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-8">
        <p className="label-caps mb-2">Your account</p>
        <h1 className="font-display text-3xl sm:text-4xl">Wishlist</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Shortlisted hardware for the next site. Prices are live — stock moves fast on popular SKUs.
        </p>
      </header>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <HeartCrack className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 font-display text-2xl">Nothing saved yet.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Tap the heart on any product to park it here while you plan the install.
          </p>
          <Button asChild className="mt-6 h-10">
            <Link href="/products">Browse the catalogue</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4" aria-label="Wishlisted products">
          {cards.map((card) => {
            const firstInStock = card.variants.find((v) => v.inStock) ?? null;
            const chosen = firstInStock ?? card.variants[0] ?? null;
            return (
              <li key={card.id} className="flex gap-4 rounded-lg border border-border bg-card p-4 sm:gap-5 sm:p-5">
                <Link href={`/products/${card.slug}`} className="shrink-0" aria-label={card.name}>
                  {card.images[0]?.url ? (
                    <img src={card.images[0].url} alt={card.images[0].alt ?? card.name} loading="lazy" className="h-24 w-24 rounded-md border border-border object-cover sm:h-28 sm:w-28" />
                  ) : (
                    <div className="h-24 w-24 rounded-md border border-border bg-muted sm:h-28 sm:w-28" aria-hidden />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.brand.name}</p>
                    <Link href={`/products/${card.slug}`} className="link-underline mt-0.5 block truncate font-medium hover:text-primary">
                      {card.name}
                    </Link>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {chosen ? chosen.name : card.category.name}
                      {card.modelNumber ? ` · ${card.modelNumber}` : ""}
                    </p>
                    <p className="mt-2 font-display text-lg">
                      {formatINR(card.priceFromPaise)}
                      {card.discountPct > 0 && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          <s>{formatINR(card.mrpFromPaise)}</s> · {card.discountPct}% off
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="mt-3 shrink-0 sm:mt-0">
                    <WishlistActions
                      productId={card.id}
                      productName={card.name}
                      skuId={chosen?.skuId ?? null}
                      inStock={card.inStock}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
