// Catalog pagination — server-rendered links preserving all query params.

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CatalogPaginationProps {
  page: number;
  totalPages: number;
  /** Current facet params (everything except page). */
  params: Record<string, string | undefined>;
}

function hrefFor(params: Record<string, string | undefined>, page: number): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || !v) continue;
    sp.set(k, v);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/products?${qs}` : "/products";
}

/** Compact window: 1 … (p-1, p, p+1) … last */
function pageWindow(page: number, totalPages: number): (number | "…")[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export function CatalogPagination({ page, totalPages, params }: CatalogPaginationProps) {
  if (totalPages <= 1) return null;
  const window_ = pageWindow(page, totalPages);

  return (
    <nav aria-label="Catalog pagination" className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link
          href={hrefFor(params, page - 1)}
          aria-label="Previous page"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:border-foreground/30"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span
          aria-hidden
          className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-md border border-border bg-card text-muted-foreground/50"
        >
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {window_.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1.5 text-xs text-muted-foreground" aria-hidden>
            …
          </span>
        ) : p === page ? (
          <span
            key={p}
            aria-current="page"
            className="flex h-9 min-w-9 items-center justify-center rounded-md bg-primary px-2 text-[13px] font-medium text-primary-foreground"
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(params, p)}
            aria-label={`Page ${p}`}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card px-2 text-[13px] text-foreground transition-colors hover:border-foreground/30"
            )}
          >
            {p}
          </Link>
        )
      )}

      {page < totalPages ? (
        <Link
          href={hrefFor(params, page + 1)}
          aria-label="Next page"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:border-foreground/30"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span
          aria-hidden
          className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-md border border-border bg-card text-muted-foreground/50"
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
