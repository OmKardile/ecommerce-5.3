import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getRelatedProducts,
  getPriceAndRating,
  getRatingDistribution,
  getProductBySlug,
} from "@/server/services/catalog.service";
import { mapProductCard } from "@/lib/serializers";
import { paiseToRupees } from "@/lib/money";
import { getCustomerSession } from "@/lib/session";
import { getWishlistProductIds } from "@/server/services/wishlist.service";
import { Gallery } from "@/components/storefront/gallery";
import { PdpStickyBar, VariantSelector } from "@/components/storefront/variant-selector";
import { PincodeChecker } from "@/components/storefront/pincode-checker";
import { ReviewForm } from "@/components/storefront/review-form";
import { ProductCard } from "@/components/storefront/product-card";
import { RecentlyViewed } from "@/components/storefront/recently-viewed";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Star, PackageCheck } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface PdpProduct {
  id: string;
  slug: string;
  name: string;
  shortDesc: string | null;
  description: string | null;
  modelNumber: string | null;
  isCodAllowed: boolean;
  warrantyMonths: number;
  specifications: unknown;
  documents: unknown;
  metaTitle: string | null;
  metaDescription: string | null;
  restockedAt: Date | null;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  images: { url: string; altText: string | null }[];
  reviews: {
    id: string;
    rating: number;
    title: string | null;
    comment: string | null;
    isVerified: boolean;
    createdAt: Date;
    user: { fullName: string | null } | null;
  }[];
  _count?: { reviews: number } | undefined;
}

function getProduct(raw: Awaited<ReturnType<typeof getProductBySlug>>): PdpProduct | null {
  if (!raw) return null;
  return raw as unknown as PdpProduct;
}

function specRows(raw: unknown): [string, string][] {
  if (!raw) return [];
  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed.flatMap((row): [string, string][] => {
        if (row && typeof row === "object" && "key" in row && "value" in row) {
          const rec = row as Record<string, unknown>;
          return [[String(rec.key), String(rec.value)]];
        }
        return [];
      });
    }
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]);
    }
    return [];
  } catch {
    return [];
  }
}

function documentLinks(raw: unknown): { label: string; url: string }[] {
  if (!raw) return [];
  try {
    const arr: unknown[] = Array.isArray(raw) ? raw : [raw];
    const out: { label: string; url: string }[] = [];
    for (const item of arr) {
      if (typeof item === "string") {
        out.push({ label: item.split("/").pop() || "Document", url: item });
      } else if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        if (typeof rec.url === "string" && rec.url) {
          out.push({
            label: typeof rec.label === "string" ? rec.label : typeof rec.title === "string" ? rec.title : "Document",
            url: rec.url,
          });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const raw = await getProductBySlug(slug);
  const product = getProduct(raw);
  if (!product) return { title: "Product not found", robots: { index: false, follow: false } };

  const title = product.metaTitle ?? `${product.name} | ${product.brand.name}`;
  const description = product.metaDescription ?? product.shortDesc ?? product.name;
  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    robots: { index: true, follow: true },
    openGraph: { title, description, type: "website" },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const raw = await getProductBySlug(slug);
  const product = getProduct(raw);
  if (!product) notFound();

  const session = await getCustomerSession();
  const [enrich, related, wishlistIds, distribution] = await Promise.all([
    getPriceAndRating([product.id]),
    getRelatedProducts(product.id, product.category.id, 4),
    getWishlistProductIds(session?.userId ?? null),
    getRatingDistribution(product.id),
  ]);
  const rating = enrich.ratings.get(product.id) ?? null;
  // getProductBySlug's include is type-erased upstream (service casts to ProductInclude); restore
  // the expected shape for the serializer.
  const rawLike = raw as unknown as Parameters<typeof mapProductCard>[0];
  const card = mapProductCard(rawLike, enrich.minPrice.get(product.id) ?? 0, rating ?? undefined);
  const relatedCards = related.map((p) => mapProductCard(p, enrich.minPrice.get(p.id) ?? 0, enrich.ratings.get(p.id)));

  const ratingCount = product._count?.reviews ?? product.reviews.length;
  const specs = specRows(product.specifications);
  const docs = documentLinks(product.documents);
  const warranty = `${product.warrantyMonths}-month brand warranty`;
  const categoryHref = `/products?category=${product.category.slug}`;

  // "Back in stock" ribbon — shown for 14 days after the OOS → available transition.
  const RESTOCK_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
  const backInStock =
    card.inStock &&
    product.restockedAt !== null &&
    Date.now() - new Date(product.restockedAt).getTime() < RESTOCK_WINDOW_MS;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDesc ?? product.metaDescription ?? product.name,
    sku: card.variants[0]?.skuCode,
    brand: { "@type": "Brand", name: product.brand.name },
    ...(card.images[0]?.url ? { image: [card.images[0].url] } : {}),
    ...(rating && rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.avg.toFixed(1),
            reviewCount: rating.count,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      url: `/products/${product.slug}`,
      priceCurrency: "INR",
      price: paiseToRupees(card.priceFromPaise).toFixed(2),
      availability: card.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: product.category.name, item: categoryHref },
      { "@type": "ListItem", position: 3, name: product.name, item: `/products/${product.slug}` },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 sm:pb-16 lg:px-8 lg:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <Breadcrumb aria-label="Breadcrumb" className="mb-8">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={categoryHref}>{product.category.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[220px] truncate sm:max-w-none">{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Buy box */}
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Gallery images={card.images} name={product.name} />

        <div className="space-y-6">
          <div>
            <Link href={`/brands/${product.brand.slug}`} className="label-caps link-underline inline-block">
              {product.brand.name}
            </Link>
            <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight sm:text-4xl">{product.name}</h1>
            {product.shortDesc && (
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{product.shortDesc}</p>
            )}
            {product.modelNumber && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Model <span className="font-mono text-[12px] text-foreground">{product.modelNumber}</span>
              </p>
            )}
            {backInStock && (
              <p
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.06] px-3.5 py-1.5 text-[13px] font-medium text-primary"
                role="status"
              >
                <PackageCheck className="h-4 w-4" aria-hidden />
                Back in stock — fresh arrival at the Surat hub
              </p>
            )}
          </div>

          <VariantSelector product={card} initialWishlisted={wishlistIds.has(product.id)} />

          <PincodeChecker />
        </div>
      </div>

      {/* Overview */}
      {product.description && (
        <section aria-label="Product overview" className="mt-14 grid gap-6 border-t border-border pt-10 lg:grid-cols-[240px_1fr] lg:gap-12">
          <h2 className="label-caps">Overview</h2>
          <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">
            {product.description}
          </p>
        </section>
      )}

      {/* Specifications */}
      {specs.length > 0 && (
        <section aria-label="Specifications" className="mt-14 grid gap-6 border-t border-border pt-10 lg:grid-cols-[240px_1fr] lg:gap-12">
          <h2 className="label-caps">Specifications</h2>
          <div className="max-w-3xl">
            <dl>
              {specs.map(([key, value]) => (
                <div key={key} className="grid grid-cols-[minmax(120px,40%)_1fr] gap-4 border-b border-border py-3 text-[14px] last:border-0">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="font-medium text-foreground">{value}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[minmax(120px,40%)_1fr] gap-4 border-b border-border py-3 text-[14px] last:border-0">
                <dt className="text-muted-foreground">Warranty</dt>
                <dd className="font-medium text-foreground">{warranty}</dd>
              </div>
              {!product.isCodAllowed && (
                <div className="grid grid-cols-[minmax(120px,40%)_1fr] gap-4 border-b border-border py-3 text-[14px] last:border-0">
                  <dt className="text-muted-foreground">Payment</dt>
                  <dd className="font-medium text-foreground">Prepaid only (high-value item)</dd>
                </div>
              )}
            </dl>

            {docs.length > 0 && (
              <div className="mt-6">
                <p className="label-caps">Documents</p>
                <ul className="mt-2 space-y-1.5">
                  {docs.map((doc) => (
                    <li key={doc.url}>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-foreground underline underline-offset-2 hover:text-accent-foreground"
                      >
                        {doc.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section aria-label="Customer reviews" className="mt-14 grid gap-6 border-t border-border pt-10 lg:grid-cols-[240px_1fr] lg:gap-12">
        <h2 className="label-caps">Reviews</h2>
        <div className="max-w-3xl space-y-8">
          <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl leading-none tabular-nums">{rating ? rating.avg.toFixed(1) : "—"}</span>
                <span className="text-[13px] text-muted-foreground">/ 5</span>
              </div>
              <div className="mt-1.5 flex items-center gap-0.5" aria-label={rating ? `Average ${rating.avg.toFixed(1)} out of 5 stars` : "No reviews yet"}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-4 w-4 ${rating && n <= Math.round(rating.avg) ? "fill-accent text-accent" : "text-border"}`}
                    aria-hidden
                  />
                ))}
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {ratingCount > 0 ? `Based on ${ratingCount} approved review${ratingCount === 1 ? "" : "s"}` : "No approved reviews yet"}
              </p>
            </div>
            {ratingCount > 0 && (
              <dl className="min-w-[180px] flex-1 space-y-1" aria-label="Rating distribution">
                {distribution.map(({ rating: star, count }) => (
                  <div key={star} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <dt className="flex w-8 shrink-0 items-center gap-0.5 tabular-nums">
                      {star}
                      <Star className="h-2.5 w-2.5 fill-accent text-accent" aria-hidden />
                    </dt>
                    <dd className="flex flex-1 items-center gap-2">
                      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-accent/70 transition-[width] duration-500"
                          style={{ width: `${ratingCount ? Math.round((count / ratingCount) * 100) : 0}%` }}
                        />
                      </span>
                      <span className="w-5 text-right tabular-nums">{count}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {product.reviews.length > 0 && (
            <ul className="space-y-7">
              {product.reviews.map((review) => (
                <li key={review.id} className="group/review border-b border-border pb-6 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`h-3.5 w-3.5 ${n <= review.rating ? "fill-accent text-accent" : "text-border"}`} aria-hidden />
                      ))}
                    </div>
                    {review.isVerified && (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-[#e7ede9] px-1.5 py-0.5 text-[10px] font-medium text-[#1a3c34] dark:bg-[#1e332c] dark:text-[#a9d0c0]">
                        <PackageCheck className="h-3 w-3" aria-hidden /> Verified purchase
                      </span>
                    )}
                    <span className="text-[12px] text-muted-foreground">
                      {review.user?.fullName ?? "Verified buyer"} · <time dateTime={new Date(review.createdAt).toISOString()}>{dateFormatter.format(new Date(review.createdAt))}</time>
                    </span>
                  </div>
                  {review.title && <p className="mt-2 font-display text-[16px] leading-snug">{review.title}</p>}
                  {review.comment && <p className="mt-1 text-[14px] leading-relaxed text-foreground/85">{review.comment}</p>}
                </li>
              ))}
            </ul>
          )}

          {/* session is already resolved above — guests see the sign-in prompt,
              signed-in customers get the full form (API enforces the session too). */}
          <ReviewForm productId={product.id} loggedIn={session !== null} />
        </div>
      </section>

      {/* Related products */}
      {relatedCards.length > 0 && (
        <section aria-label="Related products" className="mt-16 border-t border-border pt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="label-caps">Pairs well with</p>
              <h2 className="mt-2 font-display text-2xl tracking-tight">Related hardware</h2>
            </div>
            <Link href={categoryHref} className="hidden text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground sm:block">
              Browse {product.category.name.toLowerCase()}
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {relatedCards.map((rel) => (
              <ProductCard key={rel.id} product={rel} wishlisted={wishlistIds.has(rel.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Recently viewed — client-only localStorage strip */}
      <div className="mt-16">
        <RecentlyViewed
          current={{
            id: card.id,
            slug: card.slug,
            name: card.name,
            imageUrl: card.images[0]?.url ?? null,
            priceFromPaise: card.priceFromPaise,
          }}
        />
      </div>

      <PdpStickyBar product={card} />
    </div>
  );
}
