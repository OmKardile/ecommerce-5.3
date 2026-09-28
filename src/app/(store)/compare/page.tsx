import type { Metadata } from "next";
import Link from "next/link";
import {
  getProductsForCompare,
  getPriceAndRating,
} from "@/server/services/catalog.service";
import { mapProductCard } from "@/lib/serializers";
import { formatINR } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompareIdsBridge } from "@/components/storefront/compare-ids-bridge";
import { Columns3, ShieldCheck, Truck } from "lucide-react";

export const metadata: Metadata = {
  title: "Compare Products — Side-by-side specs",
  description:
    "Compare up to 4 CCTV cameras, DVRs, NVRs and networking products side by side — price, warranty, COD availability and full specifications.",
};

interface PageProps {
  searchParams: Promise<{ ids?: string }>;
}

const MAX_COMPARE = 4;

function parseSpecs(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
        .map(([k, v]) => [k, String(v)])
    );
  } catch {
    return {};
  }
}

export default async function ComparePage({ searchParams }: PageProps) {
  const { ids: idsParam } = await searchParams;
  const ids = [...new Set((idsParam ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_COMPARE);

  const rawProducts = ids.length ? await getProductsForCompare(ids) : [];
  const ratingEnrich = await getPriceAndRating(rawProducts.map((p) => p.id));
  const products = rawProducts.map((p) => ({
    card: mapProductCard(p, 0, ratingEnrich.ratings.get(p.id)),
    specs: parseSpecs(p.specifications),
  }));

  /* ---------- empty state ---------- */
  if (products.length === 0) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Hard-loaded without ?ids= → hydrate the URL from localStorage so the
            comparison table renders; with ?ids= → prune unresolvable selections. */}
        <CompareIdsBridge resolvedIds={[]} hadIdsParam={ids.length > 0} />
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Columns3 className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
          <h1 className="mt-5 font-display text-2xl text-foreground">Nothing to compare yet</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Browse the catalogue and tap the compare chip on any product card. You can line up
            up to {MAX_COMPARE} products side by side — specs, prices, warranty and more.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-md">
              <Link href="/products">Browse products</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-md border-foreground/70 hover:bg-foreground hover:text-background">
              <Link href="/kit-builder">Build a kit</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- shared spec keys in first-seen order ---------- */
  const specKeys: string[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    for (const key of Object.keys(p.specs)) {
      if (!seen.has(key)) {
        seen.add(key);
        specKeys.push(key);
      }
    }
  }

  const minPricePaise = Math.min(...products.map((p) => p.card.priceFromPaise));
  const maxWarranty = Math.max(...products.map((p) => p.card.warrantyMonths));

  const cellBase = "px-4 py-3 align-top text-[13px] leading-relaxed";

  const factRows: { label: string; render: (i: number) => React.ReactNode }[] = [
    {
      label: "Availability",
      render: (i) => {
        const p = products[i].card;
        return p.inStock ? (
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden />
            In stock{p.availableStock > 0 ? ` (${p.availableStock})` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" aria-hidden />
            Out of stock
          </span>
        );
      },
    },
    {
      label: "Rating",
      render: (i) => {
        const p = products[i].card;
        return p.ratingCount > 0 && p.ratingAvg !== null ? (
          <span>★ {p.ratingAvg.toFixed(1)} · {p.ratingCount} review{p.ratingCount === 1 ? "" : "s"}</span>
        ) : (
          <span className="text-muted-foreground">No reviews yet</span>
        );
      },
    },
    {
      label: "Warranty",
      render: (i) => {
        const p = products[i].card;
        const isBest = products.length > 1 && p.warrantyMonths === maxWarranty && p.warrantyMonths > 0;
        return (
          <span className={isBest ? "font-medium text-accent" : undefined}>
            {p.warrantyMonths > 0 ? `${p.warrantyMonths} months` : "—"}
          </span>
        );
      },
    },
    {
      label: "Cash on delivery",
      render: (i) => {
        const allowed = products[i].card.isCodAllowed;
        return allowed ? (
          <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> Allowed</span>
        ) : (
          <span className="text-muted-foreground">Prepaid only</span>
        );
      },
    },
    {
      label: "Model number",
      render: (i) => products[i].card.modelNumber ?? <span className="text-muted-foreground">—</span>,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      {/* Reconcile the persisted selection against what the server resolved. */}
      <CompareIdsBridge resolvedIds={products.map((p) => p.card.id)} hadIdsParam />
      {/* header */}
      <p className="label-caps text-muted-foreground">Side-by-side</p>
      <h1 className="mt-1 font-display text-3xl text-foreground sm:text-4xl">Compare products</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {products.length === 1
          ? "You're comparing one product — add at least one more from any product card to see differences."
          : `Comparing ${products.length} products. Specification rows only appear when at least one product documents them.`}
      </p>

      {products.length > 1 && (
        <p className="mt-3 text-xs text-muted-foreground sm:hidden">Swipe sideways to see all products →</p>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card [&_tbody>tr]:transition-colors [&_tbody>tr:hover]:bg-muted/30">
        <table className="w-full min-w-[560px] border-collapse text-left sm:min-w-[720px]">
          <caption className="sr-only">Product comparison table</caption>
          <colgroup>
            <col className="w-32 sm:w-44" />
            {products.map((p) => (
              <col key={p.card.id} className="w-44 sm:w-56" />
            ))}
          </colgroup>

          {/* product header row */}
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="sticky left-0 z-10 bg-card px-4 py-4 align-bottom text-xs font-medium text-muted-foreground sticky-col-shadow">
                {products.length > 1 ? `${products.length} of ${MAX_COMPARE}` : "Product"}
              </th>
              {products.map((p) => (
                <th key={p.card.id} scope="col" className="border-l border-border px-4 py-4 align-top">
                  <div className="relative aspect-square w-20 overflow-hidden rounded-md bg-muted sm:w-24">
                    {p.card.images[0]?.url ? (
                      <img src={p.card.images[0].url} alt={p.card.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">No image</div>
                    )}
                  </div>
                  <Link
                    href={`/products/${p.card.slug}`}
                    className="mt-3 block text-[13px] font-medium leading-snug text-foreground hover:text-accent"
                  >
                    {p.card.name}
                  </Link>
                  <span className="label-caps mt-1.5 block !text-[10px]">{p.card.brand.name}</span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* price row */}
            <tr className="border-b border-border">
              <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 text-xs font-medium text-muted-foreground sticky-col-shadow">
                Price
              </th>
              {products.map((p) => {
                const isLowest = products.length > 1 && p.card.priceFromPaise === minPricePaise;
                return (
                  <td key={p.card.id} className={cellBase}>
                    <div className="font-display text-lg leading-none">{formatINR(p.card.priceFromPaise)}</div>
                    {p.card.discountPct > 0 && (
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        <s>{formatINR(p.card.mrpFromPaise)}</s>
                        <span className="ml-1.5 font-medium text-accent">{p.card.discountPct}% off</span>
                      </div>
                    )}
                    {isLowest && (
                      <Badge className="mt-2 rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                        Lowest price
                      </Badge>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* compact fact rows */}
            {factRows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-b-0">
                <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 text-xs font-medium text-muted-foreground sticky-col-shadow">
                  {row.label}
                </th>
                {products.map((p, i) => (
                  <td key={p.card.id} className={`${cellBase} border-l border-border/60`}>
                    {row.render(i)}
                  </td>
                ))}
              </tr>
            ))}

            {/* specification rows */}
            {specKeys.length > 0 && (
              <>
                <tr>
                  <th scope="colgroup" colSpan={products.length + 1} className="bg-muted/60 px-4 py-2 text-left">
                    <span className="label-caps !text-[10px] text-muted-foreground">Specifications</span>
                  </th>
                </tr>
                {specKeys.map((key) => (
                  <tr key={key} className="border-b border-border/60 last:border-b-0">
                    <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 text-xs font-medium text-muted-foreground sticky-col-shadow">
                      {key}
                    </th>
                    {products.map((p, i) => (
                      <td key={p.card.id} className={`${cellBase} border-l border-border/60`}>
                        {p.specs[key] ?? <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* footer actions */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" className="rounded-md border-foreground/70 hover:bg-foreground hover:text-background">
          <Link href="/products">Keep browsing</Link>
        </Button>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Prices &amp; stock verified live from the server — never cached copies.
        </p>
      </div>
    </div>
  );
}
