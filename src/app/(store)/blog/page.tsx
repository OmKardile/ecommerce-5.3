import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell, ContentContainer, CtaBand } from "@/components/content/page-shell";
import { BlogCard, PostCover, PostMeta, TagChips, parseTags } from "@/components/content/blog-card";
import { Reveal } from "@/components/content/reveal";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Blog — Field Notes on CCTV, Storage & GST",
  description:
    "Installer-oriented guides from the Patel Networks trade desk: HD analog vs IP, surveillance HDD sizing, GST input tax credit on security hardware, and more.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/blog" },
};

export default async function BlogIndexPage() {
  const posts = await db.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  const [featured, ...rest] = posts;

  return (
    <PageShell
      eyebrow="Blog · Field notes"
      title="Guides from the trade counter"
      lede="The questions that reach our counter, answered in full — technology comparisons, storage mathematics and the GST paperwork that keeps installer invoices clean."
    >
      <ContentContainer>
        {posts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <h2 className="font-display text-xl tracking-tight">No field notes published yet</h2>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
              We are writing the first guides. In the meantime, the catalog and kit builder are open — or ask the
              trade desk directly.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/products"
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Browse the catalog
              </Link>
              <Link href="/contact" className="link-underline text-sm font-medium">
                Contact the desk
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Featured */}
            {featured ? (
              <Reveal>
                <Link
                  href={`/blog/${featured.slug}`}
                  className="group grid gap-0 overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:shadow-sm md:grid-cols-2"
                >
                  <div className="p-4 pb-0 md:py-4 md:pl-4">
                    <PostCover post={featured} ratio="aspect-[4/3] md:aspect-auto md:h-full md:min-h-[320px]" />
                  </div>
                  <div className="flex flex-col justify-center p-6 md:p-10">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-foreground">
                        Latest
                      </span>
                      <PostMeta post={featured} />
                    </div>
                    <h2 className="mt-4 font-display text-2xl leading-tight tracking-tight md:text-3xl">
                      {featured.title}
                    </h2>
                    {featured.excerpt ? (
                      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground md:text-[15px]">
                        {featured.excerpt}
                      </p>
                    ) : null}
                    <div className="mt-5">
                      <TagChips tags={parseTags(featured)} />
                    </div>
                    <span className="mt-6 inline-flex items-center gap-2 text-[14px] font-medium">
                      Read the guide
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                        aria-hidden
                      />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ) : null}

            {/* Grid */}
            {rest.length > 0 ? (
              <section aria-label="All articles" className="mt-12 border-t border-border pt-10">
                <h2 className="label-caps">All articles</h2>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post, i) => (
                    <BlogCard
                      key={post.id}
                      index={i}
                      post={{
                        slug: post.slug,
                        title: post.title,
                        excerpt: post.excerpt,
                        coverImageUrl: post.coverImageUrl,
                        publishedAt: post.publishedAt,
                        tags: post.tags,
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mt-14 border-t border-border pt-10 pb-4 lg:pb-8">
              <CtaBand
                title="Specifying hardware instead of reading about it?"
                body="The catalog carries the cameras, recorders, drives and cabling these guides discuss — or the kit builder assembles a matched set for you."
                href="/products"
                ctaLabel="Browse the catalog"
                secondaryHref="/kit-builder"
                secondaryLabel="Build a kit"
              />
            </div>
          </>
        )}
      </ContentContainer>
    </PageShell>
  );
}
