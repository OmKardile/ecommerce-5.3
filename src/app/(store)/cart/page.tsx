import type { Metadata } from "next";
import Link from "next/link";
import { CartView } from "@/components/storefront/cart-view";
import { ProductCard } from "@/components/storefront/product-card";
import { getInstallAccessories, getPriceAndRating } from "@/server/services/catalog.service";
import { mapProductCard } from "@/lib/serializers";

export const metadata: Metadata = {
  title: "Your Cart",
  description: "Review your surveillance & networking hardware before checkout.",
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  // Cross-sell rail (AOV driver): install-completing accessories. Rendered
  // server-side so it works for guests too; hidden entirely when the catalog
  // has no accessory stock rather than showing an empty shell.
  const accessories = await getInstallAccessories(4);
  const enrich = accessories.length ? await getPriceAndRating(accessories.map((p) => p.id)) : null;
  const cards = accessories.map((p) => mapProductCard(p, enrich?.minPrice.get(p.id) ?? 0, enrich?.ratings.get(p.id)));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-8 lg:mb-10">
        <p className="label-caps mb-2">Step 1 of 3 · Review</p>
        <h1 className="font-display text-3xl sm:text-4xl">Your cart</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Prices are GST-inclusive. Stock is reserved for you the moment the order is placed.
        </p>
      </header>
      <CartView />

      {cards.length > 0 && (
        <section aria-label="Complete your install" className="mt-14 border-t border-border pt-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="label-caps">Complete your install</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cables, connectors and power that most CCTV jobs end up needing.
              </p>
            </div>
            <Link href="/products?category=connectors-accessories" className="text-sm text-primary underline underline-offset-4 hover:decoration-2">
              Browse all accessories
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {cards.map((card) => (
              <ProductCard key={card.id} product={card} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
