// Route-level skeleton for /products — mirrors the sidebar + grid layout so the
// first paint holds the editorial structure instead of an empty flash.

import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-8">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-9 w-72" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden space-y-6 lg:block" aria-hidden>
          {["w-24", "w-32", "w-20", "w-28", "w-24"].map((w, i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className={`h-3.5 ${w}`} />
              {[0, 1, 2].map((j) => (
                <Skeleton key={j} className="h-4 w-full max-w-44" />
              ))}
            </div>
          ))}
        </aside>
        <div>
          <div className="mb-5 flex items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4">
                <Skeleton className="aspect-square w-full rounded-md" />
                <Skeleton className="mt-4 h-3 w-20" />
                <Skeleton className="mt-2 h-5 w-3/4" />
                <Skeleton className="mt-3 h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
