import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageShell, ContentContainer, CtaBand } from "@/components/content/page-shell";
import { PostCover, PostMeta, TagChips, parseTags } from "@/components/content/blog-card";
import { BlogPostBody } from "@/components/content/blog-post-body";
import { Reveal } from "@/components/content/reveal";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string) {
  const post = await db.post.findUnique({ where: { slug } });
  if (!post || post.status !== "PUBLISHED") return null;
  return post;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    return { title: "Article not found — Patel Networks" };
  }
  return {
    title: `${post.title} | Patel Networks Blog`,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt ?? undefined,
      publishedTime: post.publishedAt?.toISOString(),
      tags: parseTags(post),
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  // Newer / older neighbours within the published feed.
  const siblings = await db.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { slug: true, title: true },
  });
  const idx = siblings.findIndex((p) => p.slug === post.slug);
  const newer = idx > 0 ? siblings[idx - 1] : null;
  const older = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const words = post.content.trim().split(/\s+/).length;
  const readMinutes = Math.max(2, Math.round(words / 200));
  const tags = parseTags(post);

  return (
    <PageShell eyebrow="Blog · Field notes" title={post.title}>
      <ContentContainer>
        <Reveal>
          <div className="mx-auto max-w-3xl">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <PostMeta post={post} />
              <p className="label-caps !text-[10px]">{readMinutes} min read</p>
              <p className="label-caps !text-[10px]">Patel Networks trade desk</p>
            </div>

            {/* Cover */}
            <div className="mt-6">
              <PostCover post={post} ratio="aspect-[2/1]" />
            </div>

            {/* Body */}
            <div className="mt-8">
              <BlogPostBody content={post.content} />
            </div>

            {/* Tags */}
            {tags.length > 0 ? (
              <div className="mt-12 border-t border-border pt-6">
                <TagChips tags={tags} />
              </div>
            ) : null}
          </div>
        </Reveal>

        {/* Prev / next */}
        <nav aria-label="More articles" className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
          {newer ? (
            <Link
              href={`/blog/${newer.slug}`}
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <p className="label-caps flex items-center gap-2 !text-[10px]">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Newer
              </p>
              <p className="mt-2 font-display text-base leading-snug tracking-tight group-hover:underline group-hover:underline-offset-4">
                {newer.title}
              </p>
            </Link>
          ) : (
            <span aria-hidden className="hidden sm:block" />
          )}
          {older ? (
            <Link
              href={`/blog/${older.slug}`}
              className="group rounded-lg border border-border bg-card p-5 text-right transition-colors hover:bg-muted/50"
            >
              <p className="label-caps flex items-center justify-end gap-2 !text-[10px]">
                Older <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </p>
              <p className="mt-2 font-display text-base leading-snug tracking-tight group-hover:underline group-hover:underline-offset-4">
                {older.title}
              </p>
            </Link>
          ) : null}
        </nav>

        {/* CTA */}
        <div className="mx-auto mt-14 max-w-3xl pb-4 lg:pb-8">
          <CtaBand
            title="Ready to specify the hardware?"
            body="Everything discussed in this guide is stocked at the Surat hub — browse the catalog or let the kit builder assemble a matched set."
            href="/products"
            ctaLabel="Browse the catalog"
            secondaryHref="/kit-builder"
            secondaryLabel="Build a kit"
          />
        </div>
      </ContentContainer>
    </PageShell>
  );
}
