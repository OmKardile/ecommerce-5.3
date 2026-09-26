import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrandBySlug, getPriceAndRating } from "@/server/services/catalog.service";
import { getWishlistProductIds } from "@/server/services/wishlist.service";
import { getCustomerSession } from "@/lib/session";
import { mapProductCard } from "@/lib/serializers";
import { ProductCard } from "@/components/storefront/product-card";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getBrandBySlug(slug);
  if (!result) return { title: "Brand not found | Patel Networks", robots: { index: false, follow: false } };
  return {
    title: `${result.brand.name} — Products | Patel Networks`,
    description:
      result.brand.description ??
      `Browse ${result.brand.name} surveillance and networking hardware stocked by Patel Networks.`,
    robots: { index: true, follow: true },
  };
}

export default async function BrandDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getBrandBySlug(slug);
  if (!result) notFound();

  const { brand, products } = result;
  const session = await getCustomerSession();
  const [enrich, wishlistIds] = await Promise.all([
    getPriceAndRating(products.map((p) => p.id)),
    getWishlistProductIds(session?.userId ?? null),
  ]);
  const cards = products.map((p) =>
    mapProductCard(p, enrich.minPrice.get(p.id) ?? 0, enrich.ratings.get(p.id))
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <nav aria-label="Breadcrumb" className="mb-8 text-[13px] text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-foreground hover:underline underline-offset-2">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/brands" className="hover:text-foreground hover:underline underline-offset-2">
              Brands
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-foreground">
            {brand.name}
          </li>
        </ol>
      </nav>

      <header className="max-w-2xl border-b border-border pb-8">
        <p className="label-caps">Brand</p>
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl">{brand.name}</h1>
        {brand.description && (
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{brand.description}</p>
        )}
        <p className="label-caps mt-4 !text-[10px]">
          {brand._count.products} product{brand._count.products === 1 ? "" : "s"} in stock
        </p>
      </header>

      {cards.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <ProductCard key={card.id} product={card} wishlisted={wishlistIds.has(card.id)} />
          ))}
        </div>
      ) : (
        <div className="mt-12 border-t border-border pt-10">
          <h2 className="font-display text-2xl">This brand is being restocked.</h2>
          <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
            Our counter team updates stock weekly — call us for availability and sourcing timelines.
          </p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse all products
          </Link>
        </div>
      )}
    </div>
  );
}
