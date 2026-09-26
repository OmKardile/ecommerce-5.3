import Link from "next/link";
import { ArrowRight, Boxes, ClipboardCheck, Truck } from "lucide-react";
import { getCategoryTree, getFeaturedProducts, getBrands, getPriceAndRating } from "@/server/services/catalog.service";
import { getWishlistProductIds } from "@/server/services/wishlist.service";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { mapProductCard } from "@/lib/serializers";
import { ProductCard } from "@/components/storefront/product-card";
import { RecentlyViewedRail } from "@/components/storefront/recently-viewed";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const KIT_STEPS = [
  { n: "01", title: "Recorder", body: "4/8/16-channel DVR (HD analog) or PoE NVR." },
  { n: "02", title: "Cameras", body: "Mix indoor domes & outdoor bullets — bounded by channels." },
  { n: "03", title: "Storage", body: "Surveillance HDD with retention-day estimate." },
  { n: "04", title: "Power & cable", body: "SMPS, coax/Cat6 rolls and connector packs." },
  { n: "05", title: "Add kit to cart", body: "One click, every SKU, 5% bundle discount." },
];

export default async function HomePage() {
  const session = await getCustomerSession();
  const [categories, featuredRaw, brands, posts, wishlistIds, banners] = await Promise.all([
    getCategoryTree(),
    getFeaturedProducts(8),
    getBrands(),
    db.post.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 3 }),
    getWishlistProductIds(session?.userId ?? null),
    db.banner.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const enrich = await getPriceAndRating(featuredRaw.map((p) => p.id));
  const featured = featuredRaw.map((p) => mapProductCard(p, enrich.minPrice.get(p.id) ?? 0, enrich.ratings.get(p.id)));

  const heroImage = categories.find((c) => c.slug === "cctv-surveillance")?.imageUrl;
  // Storefront finally consumes the Banner table (managed at /admin/banners):
  // HOME_HERO = full-bleed hero backdrop, HOME_STRIP = mid-page promo band.
  const heroBannerUrl = banners.find((b) => b.placement === "HOME_HERO")?.imageUrl ?? heroImage;
  const stripBanner = banners.find((b) => b.placement === "HOME_STRIP");

  const heroCopy = (
    <>
      <p className="label-caps">Authorized distribution · Surat, Gujarat</p>
      <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
        Surveillance &amp; networking hardware,
        <span className="block italic text-primary">specified right the first time.</span>
      </h1>
      <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
        Genuine Hikvision, Dahua, CP Plus and D-Link equipment for homes, installers and system integrators —
        with SKU-level stock you can actually rely on, GST tax invoices and pan-India dispatch.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button asChild size="lg" className="rounded-full px-6">
          <Link href="/products">
            Browse catalog <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="rounded-full border-foreground/25 px-6">
          <Link href="/kit-builder">Build a CCTV kit</Link>
        </Button>
      </div>
      <p className="mt-6 text-[13px] text-muted-foreground">
        {brands.length} authorized brands · B2B GSTIN billing · Same-day dispatch before 4 PM IST
      </p>
    </>
  );

  return (
    <div>
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden border-b border-border">
        {heroBannerUrl ? (
          <>
            {/* full-bleed backdrop (HOME_HERO banner) + paper gradient for headline negative space */}
            <img
              src={heroBannerUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-background/60 lg:hidden" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-background from-0% via-background/55 via-38% to-transparent to-66%" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/55 from-0% to-transparent to-30%" />
          </>
        ) : null}
        <div className={`relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-6 ${heroBannerUrl ? "py-16 lg:py-28" : "py-12 lg:py-20"}`}>
          <div className={heroBannerUrl ? "lg:col-span-7" : "lg:col-span-6 xl:col-span-5"}>{heroCopy}</div>
          {!heroBannerUrl && (
            <div className="relative lg:col-span-6 xl:col-span-7">
              <div className="relative ml-auto aspect-[4/3] w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-muted lg:ml-12 xl:ml-auto">
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Surveillance imagery</div>
              </div>
            </div>
          )}
        </div>
        {heroBannerUrl && (
          <div className="absolute bottom-6 right-4 hidden w-60 rounded-lg border border-border/70 bg-card/85 p-4 shadow-sm backdrop-blur-sm md:block">
            <p className="label-caps !text-[10px]">SKU-level inventory</p>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
              Every camera, recorder and drum of cable has its own tracked stock — the count you see is the count that
              ships.
            </p>
          </div>
        )}
      </section>

      {/* ---------- categories ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="label-caps">Shop by category</p>
            <h2 className="mt-2 font-display text-3xl tracking-tight">Five departments, one counter.</h2>
          </div>
          <Link href="/products" className="link-underline hidden shrink-0 text-sm font-medium sm:block">
            All products →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {categories.map((c, i) => (
            <Link
              key={c.id}
              href={`/products?category=${c.slug}`}
              className={`group overflow-hidden rounded-lg border border-border bg-card transition-all hover:shadow-sm ${i === 0 ? "col-span-2 md:col-span-3 lg:col-span-1" : ""}`}
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                {c.imageUrl ? (
                   
                  <img src={c.imageUrl} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{c.name}</div>
                )}
              </div>
              <div className="p-3.5">
                <p className="text-sm font-medium leading-snug">{c.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.children.length} subcategories</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- kit builder band ---------- */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-16">
          <div className="lg:col-span-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/60">Kit Builder</p>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              A complete CCTV kit, assembled in five considered steps.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/75">
              No compatibility guessing. Pick a recorder, add cameras within its channel count, choose storage with a
              retention estimate, then let us pair the power supply and cable. The 5% bundle discount applies itself.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-7 rounded-full px-6">
              <Link href="/kit-builder">
                Start building <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-primary-foreground/15 bg-primary-foreground/10 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-5">
            {KIT_STEPS.map((s) => (
              <div key={s.n} className="bg-primary p-5">
                <p className="font-display text-2xl text-primary-foreground/40">{s.n}</p>
                <p className="mt-3 text-sm font-semibold">{s.title}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-primary-foreground/70">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- featured products ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="label-caps">Featured hardware</p>
            <h2 className="mt-2 font-display text-3xl tracking-tight">What installers keep reordering.</h2>
          </div>
          <Link href="/products" className="link-underline hidden shrink-0 text-sm font-medium sm:block">
            View all →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} wishlisted={wishlistIds.has(p.id)} />
          ))}
        </div>
      </section>

      {/* ---------- recently viewed (client island — hidden until the visitor has history) ---------- */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <RecentlyViewedRail />
      </section>

      {/* ---------- promo strip (HOME_STRIP banner) ---------- */}
      {stripBanner && (
        <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
          <Link
            href={stripBanner.linkUrl ?? "/kit-builder"}
            className="group relative block overflow-hidden rounded-lg border border-border transition-shadow hover:shadow-md"
          >
            <div className="relative aspect-[16/7] sm:aspect-[64/11]">
              {stripBanner.imageUrl ? (
                <img
                  src={stripBanner.imageUrl}
                  alt={stripBanner.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="h-full w-full bg-muted" />
              )}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-background/5" />
              <div className="absolute inset-0 flex flex-col justify-center gap-1 px-6 sm:px-10">
                <p className="label-caps">Complete systems</p>
                <h3 className="font-display text-2xl leading-tight tracking-tight sm:text-3xl">{stripBanner.title}</h3>
                {stripBanner.subtitle && (
                  <p className="mt-1 hidden max-w-md text-[13px] leading-relaxed text-muted-foreground sm:block">
                    {stripBanner.subtitle}
                  </p>
                )}
              </div>
              <span className="absolute bottom-4 right-4 hidden items-center gap-1 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:inline-flex">
                Build now <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        </section>
      )}

      {/* ---------- brands ---------- */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <span className="label-caps mr-2">Authorized brands</span>
            {brands.map((b) => (
              <Link key={b.id} href={`/brands/${b.slug}`} className="font-display text-lg text-foreground/60 transition-colors hover:text-foreground">
                {b.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- service commitments (documented policies) ---------- */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
        {[
          { icon: ClipboardCheck, title: "7-day DOA guarantee", body: "Dead-on-arrival units are replaced immediately after serial verification — every unit is serial-scanned at dispatch for clean RMA claims.", href: "/return-policy" },
          { icon: Truck, title: "Surat hub, same-day handover", body: "Orders confirmed and paid before 4:00 PM IST (Mon–Sat) leave the warehouse the same day via Delhivery and Shiprocket networks.", href: "/shipping-policy" },
          { icon: Boxes, title: "Built for B2B purchasing", body: "GSTIN input-tax-credit invoices, saved site addresses and contractor verification for repeat bulk orders.", href: "/contact" },
        ].map((item) => (
          <div key={item.title} className="border-t border-foreground/15 pt-6">
            <item.icon className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="mt-4 font-display text-xl">{item.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{item.body}</p>
            <Link href={item.href} className="link-underline mt-3 inline-block text-[13px] font-medium">
              Read the policy →
            </Link>
          </div>
        ))}
      </section>

      {/* ---------- journal ---------- */}
      {posts.length > 0 && (
        <section className="border-t border-border bg-muted/40">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="label-caps">Field notes</p>
                <h2 className="mt-2 font-display text-3xl tracking-tight">Guides from the trade.</h2>
              </div>
              <Link href="/blog" className="link-underline hidden shrink-0 text-sm font-medium sm:block">
                All articles →
              </Link>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="group overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-sm">
                  <div className="aspect-[16/8] overflow-hidden bg-muted">
                    {post.coverImageUrl ? (
                      <img
                        src={post.coverImageUrl}
                        alt={post.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Field note</div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    </p>
                    <h3 className="mt-2 font-display text-lg leading-snug group-hover:text-primary">{post.title}</h3>
                    <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{post.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
