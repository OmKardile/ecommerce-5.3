import type { Metadata } from "next";
import Link from "next/link";
import {
  getCategoryTree,
  getBrands,
  getPriceAndRating,
  listProducts,
} from "@/server/services/catalog.service";
import { mapProductCard } from "@/lib/serializers";
import { productQuerySchema } from "@/lib/validators";
import { getCustomerSession } from "@/lib/session";
import { getWishlistProductIds } from "@/server/services/wishlist.service";
import { ProductCard } from "@/components/storefront/product-card";
import {
  ActiveFilterChip,
  MobileFilters,
  FiltersPanel,
  type BrandFacet,
  type CatalogActiveParams,
} from "@/components/storefront/filters-panel";
import { CatalogSort } from "@/components/storefront/catalog-sort";
import { CatalogPagination } from "@/components/storefront/catalog-pagination";

export const metadata: Metadata = {
  title: "All Products — CCTV, Surveillance & Networking",
  description:
    "Browse surveillance cameras, DVRs, NVRs, monitors, cables and connectors. Faceted catalog with price, resolution and availability filters.",
  robots: { index: true, follow: true },
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function toActiveParams(sp: SearchParams): CatalogActiveParams {
  return {
    q: first(sp.q),
    category: first(sp.category),
    brand: first(sp.brand),
    minPrice: first(sp.minPrice),
    maxPrice: first(sp.maxPrice),
    resolution: first(sp.resolution),
    availability: first(sp.availability),
    minRating: first(sp.minRating),
    sort: first(sp.sort),
  };
}

/** Query string minus one token from a (possibly comma-separated) param. */
function hrefWithout(params: CatalogActiveParams, key: keyof CatalogActiveParams, token?: string): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    if (k === key) continue;
    if (k === "page") continue;
    sp.set(k, v);
  }
  if (token) {
    const remaining = (params[key] ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && t !== token);
    if (remaining.length) sp.set(key, remaining.join(","));
  }
  const qs = sp.toString();
  return qs ? `/products?${qs}` : "/products";
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const active = toActiveParams(sp);

  const parsed = productQuerySchema.safeParse({
    ...active,
    page: first(sp.page) ?? undefined,
    perPage: first(sp.perPage) ?? undefined,
  });
  const query = parsed.success ? parsed.data : productQuerySchema.parse({});

  const session = await getCustomerSession();
  const [tree, brandRows, result, wishlistIds] = await Promise.all([
    getCategoryTree(),
    getBrands(),
    listProducts(query),
    getWishlistProductIds(session?.userId ?? null),
  ]);
  const enrich = await getPriceAndRating(result.items.map((p) => p.id));
  const cards = result.items.map((p) =>
    mapProductCard(p, enrich.minPrice.get(p.id) ?? 0, enrich.ratings.get(p.id))
  );

  const brands: BrandFacet[] = brandRows.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    productCount: b._count.products,
  }));

  // Active filter chips
  const catName = (slug: string): string | null => {
    for (const root of tree) {
      if (root.slug === slug) return root.name;
      const child = root.children.find((c) => c.slug === slug);
      if (child) return child.name;
    }
    return null;
  };
  const brandName = (slug: string): string | null => brands.find((b) => b.slug === slug)?.name ?? null;

  const chips: { label: string; href: string }[] = [];
  if (active.q) chips.push({ label: `“${active.q}”`, href: hrefWithout(active, "q") });
  if (active.category) {
    const name = catName(active.category);
    if (name) chips.push({ label: name, href: hrefWithout(active, "category") });
  }
  for (const slug of (active.brand ?? "").split(",").filter(Boolean)) {
    const name = brandName(slug) ?? slug;
    chips.push({ label: name, href: hrefWithout(active, "brand", slug) });
  }
  for (const res of (active.resolution ?? "").split(",").filter(Boolean)) {
    chips.push({ label: res, href: hrefWithout(active, "resolution", res) });
  }
  if (active.minPrice || active.maxPrice) {
    const label = `₹${active.minPrice ?? "0"} – ₹${active.maxPrice ?? "∞"}`;
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(active)) {
      if (!v || k === "page" || k === "minPrice" || k === "maxPrice") continue;
      sp.set(k, v);
    }
    const qs = sp.toString();
    chips.push({ label, href: qs ? `/products?${qs}` : "/products" });
  }
  if (active.availability === "in-stock") chips.push({ label: "In stock only", href: hrefWithout(active, "availability") });
  if (active.minRating) chips.push({ label: `${active.minRating}★ & up`, href: hrefWithout(active, "minRating") });

  const facetParams: Record<string, string | undefined> = { ...active };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      {/* Editorial header */}
      <header className="max-w-2xl">
        <p className="label-caps">Catalog</p>
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          Surveillance &amp; networking hardware
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Cameras, recorders, storage, cables and connectors — curated by our Surat counter team,
          stocked and warranted. GST-inclusive pricing across the board.
        </p>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[240px_1fr] lg:gap-12">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block" aria-label="Product filters">
          <div className="lg:sticky lg:top-24">
            <FiltersPanel tree={tree} brands={brands} active={active} />
          </div>
        </aside>

        <section aria-label="Product results">
          {/* Active filter chips */}
          {chips.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="Active filters">
              {chips.map((chip, i) => (
                <ActiveFilterChip key={`${chip.label}-${i}`} label={chip.label} removeLabel={`Remove filter ${chip.label}`} href={chip.href} />
              ))}
              <Link href="/products" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                Reset
              </Link>
            </div>
          )}

          {/* Toolbar: mobile filters + sort + count */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {result.total} product{result.total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <div className="lg:hidden">
                <MobileFilters tree={tree} brands={brands} active={active} resultCount={result.total} />
              </div>
              <CatalogSort active={active} />
            </div>
          </div>

          {/* Grid */}
          {cards.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <ProductCard key={card.id} product={card} wishlisted={wishlistIds.has(card.id)} />
              ))}
            </div>
          ) : (
            <div className="mt-16 flex flex-col items-start gap-3 border-t border-border pt-12">
              <p className="label-caps">No matches</p>
              <h2 className="font-display text-2xl">Nothing on the shelf for this combination.</h2>
              <p className="max-w-md text-[15px] text-muted-foreground">
                Try widening the price range, clearing a brand or two, or searching for a model
                number. Our counter team can also source items on request — call{" "}
                <a href="tel:+919876543210" className="underline underline-offset-2">
                  +91 98765 43210
                </a>
                .
              </p>
              <Link
                href="/products"
                className="mt-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Reset all filters
              </Link>
            </div>
          )}

          <CatalogPagination page={result.page} totalPages={result.totalPages} params={facetParams} />
        </section>
      </div>
    </div>
  );
}
