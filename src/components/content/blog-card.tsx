import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Reveal } from "./reveal";
import { ParallaxImage } from "@/components/motion/parallax";

// Shared blog pieces: cover (image or quiet typographic panel), tag chips,
// meta row, and the standard card used by the index grid.
// Blog covers may be absent in seed data — the typographic panel keeps the
// editorial rhythm without inventing imagery.

export interface BlogPostLike {
  slug: string;
  title: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  publishedAt: Date | string | null;
  tags?: string | null; // JSON string[]
}

export function parseTags(post: Pick<BlogPostLike, "tags">): string[] {
  if (!post.tags) return [];
  try {
    const parsed: unknown = JSON.parse(post.tags);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function formatPostDate(date: BlogPostLike["publishedAt"]): string {
  if (!date) return "Unpublished";
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Article tags">
      {tags.map((tag) => (
        <li
          key={tag}
          className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}

export function PostCover({
  post,
  ratio = "aspect-[4/3]",
  className = "",
  parallax = false,
}: {
  post: Pick<BlogPostLike, "title" | "coverImageUrl">;
  ratio?: string;
  className?: string;
  /** Article-detail covers only: scroll parallax on the image (needs the ratio container to clip). */
  parallax?: boolean;
}) {
  if (post.coverImageUrl) {
    return (
      <div className={`relative ${ratio} overflow-hidden rounded-lg border border-border bg-muted ${className}`}>
        {parallax ? (
          <ParallaxImage src={post.coverImageUrl} alt={post.title} offset={["start end", "end start"]} scale={1.16} from="-6%" to="6%" />
        ) : (
          <img src={post.coverImageUrl} alt={post.title} loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
    );
  }
  return (
    <div
      className={`${ratio} flex flex-col justify-between overflow-hidden rounded-lg border border-border bg-muted/70 p-5 ${className}`}
      aria-hidden
    >
      <p className="label-caps !text-[10px]">Field notes · Surveillance trade</p>
      <p className="font-display text-lg leading-snug tracking-tight text-foreground/70 line-clamp-3">{post.title}</p>
    </div>
  );
}

export function PostMeta({ post }: { post: BlogPostLike }) {
  return (
    <p className="label-caps flex items-center gap-2 !text-[10px]">
      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
      {formatPostDate(post.publishedAt)}
    </p>
  );
}

/** Standard card for the blog index grid. */
export function BlogCard({ post, index = 0 }: { post: BlogPostLike; index?: number }) {
  const tags = parseTags(post);
  return (
    <Reveal delay={(index % 3) * 0.06}>
      <Link
        href={`/blog/${post.slug}`}
        className="group flex h-full flex-col rounded-lg border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm"
      >
        <div className="p-4 pb-0">
          <PostCover post={post} />
        </div>
        <div className="flex flex-1 flex-col p-5">
          <PostMeta post={post} />
          <h3 className="mt-2.5 font-display text-xl leading-snug tracking-tight">{post.title}</h3>
          {post.excerpt ? (
            <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{post.excerpt}</p>
          ) : null}
          <div className="mt-auto pt-4">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              Read the guide
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </div>
        </div>
      </Link>
    </Reveal>
  );
}
