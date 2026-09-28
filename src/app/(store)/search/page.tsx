import type { Metadata } from "next";
import Link from "next/link";
import { getPriceAndRating, listProducts } from "@/server/services/catalog.service";
import { getWishlistProductIds } from "@/server/services/wishlist.service";
import { getCustomerSession } from "@/lib/session";
import { mapProductCard } from "@/lib/serializers";
import { ProductCard } from "@/components/storefront/product-card";

export const metadata: Metadata = {
  title: "Search",
  description: "Search surveillance cameras, recorders, cables and networking hardware.",
  robots: { index: false, follow: true },
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const rawQ = sp.q;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ)?.trim() ?? "";

  const session = await getCustomerSession();
  const [result, wishlistIds] = await Promise.all([
    q ? listProducts({ q, sort: "popular", page: 1, perPage: 24 }) : Promise.resolve({ items: [], total: 0, page: 1, perPage: 24, totalPages: 1 }),
    getWishlistProductIds(session?.userId ?? null),
  ]);
  const enrich = await getPriceAndRating(result.items.map((p) => p.id));
  const cards = result.items.map((p) =>
    mapProductCard(p, enrich.minPrice.get(p.id) ?? 0, enrich.ratings.get(p.id))
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="max-w-2xl border-b border-border pb-8">
        <p className="label-caps">Search</p>
        {q ? (
          <>
            <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              Results for &ldquo;{q}&rdquo;
            </h1>
            <p className="mt-3 text-[14px] text-muted-foreground" aria-live="polite">
              {result.total} product{result.total === 1 ? "" : "s"} found
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              What are you installing?
            </h1>
            <p className="mt-3 text-[14px] text-muted-foreground">
              Use the search bar above — try a model number like &ldquo;CP-UVR-0801E1-S&rdquo; or a
              category like &ldquo;dome camera&rdquo;.
            </p>
          </>
        )}
      </header>

      {cards.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <ProductCard key={card.id} product={card} wishlisted={wishlistIds.has(card.id)} />
          ))}
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-start gap-3">
          <h2 className="font-display text-2xl">
            {q ? "Nothing matched that search." : "The shelf is waiting."}
          </h2>
          <p className="max-w-md text-[15px] text-muted-foreground">
            {q
              ? "Check the spelling or try a shorter term — the catalog covers cameras, recorders, storage, monitors, cables and connectors."
              : "Browse the full catalog to see everything stocked at our Surat hub."}
          </p>
          <Link
            href="/products"
            className="mt-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse all products
          </Link>
        </div>
      )}
    </div>
  );
}
