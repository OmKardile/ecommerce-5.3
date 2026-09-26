"use client";

// Sort control — pushes the updated query string; page resets on sort change.

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface CatalogSortParams {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  resolution?: string;
  availability?: string;
  minRating?: string;
  sort?: string;
}

const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest first" },
] as const;

export function CatalogSort({ active }: { active: CatalogSortParams }) {
  const router = useRouter();
  const value = active.sort ?? "popular";

  function onChange(next: string) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(active)) {
      if (k === "page") continue;
      if (k === "sort") continue;
      if (v) sp.set(k, v);
    }
    if (next && next !== "popular") sp.set("sort", next);
    const qs = sp.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  }

  return (
    <div className="flex items-center gap-2">
      <span className="label-caps hidden sm:block">Sort</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label="Sort products"
          className="h-9 w-[180px] rounded-md border-border bg-card text-[13px] shadow-none focus:ring-0"
        >
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent className="rounded-md">
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-[13px]">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
