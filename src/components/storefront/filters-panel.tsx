"use client";

// Catalog facet filters — category tree, brands, price, resolution, availability, rating.
// Navigation is URL-driven (server re-renders the catalog); no client fetching.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { CategoryFacet } from "@/server/services/catalog.service";

export interface CatalogActiveParams {
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

export interface BrandFacet {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

const RESOLUTIONS = ["2MP", "3MP", "4MP", "5MP", "8MP"] as const;

/** Merge param overrides into a query string; a null change removes the key. Page resets. */
function buildQuery(active: CatalogActiveParams, changes: Record<string, string | null>): string {
  const sp = new URLSearchParams();
  const keys = new Set([...Object.keys(active), ...Object.keys(changes)]);
  for (const k of keys) {
    if (k === "page") continue;
    const next = k in changes ? changes[k] : (active[k as keyof CatalogActiveParams] ?? null);
    if (next) sp.set(k, next);
  }
  return sp.toString();
}

function useFacetNavigate() {
  const router = useRouter();
  return useCallback(
    (active: CatalogActiveParams, changes: Record<string, string | null>) => {
      const qs = buildQuery(active, changes);
      router.push(qs ? `/products?${qs}` : "/products");
    },
    [router]
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="label-caps">{children}</p>;
}

interface FiltersPanelProps {
  tree: CategoryFacet[];
  brands: BrandFacet[];
  active: CatalogActiveParams;
}

export function FiltersPanel({ tree, brands, active }: FiltersPanelProps) {
  const navigate = useFacetNavigate();
  const [minPrice, setMinPrice] = useState(active.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(active.maxPrice ?? "");
  const [synced, setSynced] = useState({ min: active.minPrice, max: active.maxPrice });

  // Adjust local input state when the URL params change (React's render-time state adjustment).
  if (synced.min !== active.minPrice || synced.max !== active.maxPrice) {
    setSynced({ min: active.minPrice, max: active.maxPrice });
    setMinPrice(active.minPrice ?? "");
    setMaxPrice(active.maxPrice ?? "");
  }

  const selectedBrands = new Set((active.brand ?? "").split(",").filter(Boolean));
  const selectedResolutions = new Set((active.resolution ?? "").split(",").filter(Boolean));

  function applyPrice() {
    const min = minPrice.trim();
    const max = maxPrice.trim();
    const minNum = min === "" ? null : Number.isFinite(Number(min)) && Number(min) >= 0 ? min : null;
    const maxNum = max === "" ? null : Number.isFinite(Number(max)) && Number(max) >= 0 ? max : null;
    navigate(active, { minPrice: minNum, maxPrice: maxNum });
  }

  function toggleBrand(slug: string, checked: boolean) {
    const next = new Set(selectedBrands);
    if (checked) next.add(slug);
    else next.delete(slug);
    navigate(active, { brand: next.size ? [...next].join(",") : null });
  }

  function toggleResolution(value: string) {
    const next = new Set(selectedResolutions);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    navigate(active, { resolution: next.size ? [...next].join(",") : null });
  }

  const hasFacets =
    Boolean(active.category || active.brand || active.minPrice || active.maxPrice || active.resolution || active.availability || active.minRating);

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <SectionLabel>Refine</SectionLabel>
        {hasFacets && (
          <button
            type="button"
            onClick={() => navigate(active, { category: null, brand: null, minPrice: null, maxPrice: null, resolution: null, availability: null, minRating: null })}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear all filters"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Clear all
          </button>
        )}
      </div>

      {/* Category — radio list incl. subcategories */}
      <section aria-label="Category filter" className="space-y-3">
        <SectionLabel>Category</SectionLabel>
        <RadioGroup
          value={active.category ?? ""}
          onValueChange={(v) => navigate(active, { category: v || null })}
        >
          <div className="flex items-center gap-2.5">
            <RadioGroupItem value="" id="cat-all" />
            <Label htmlFor="cat-all" className="cursor-pointer text-[13px] font-normal text-foreground">
              All categories
            </Label>
          </div>
          {tree.map((root) => (
            <div key={root.id} className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <RadioGroupItem value={root.slug} id={`cat-${root.slug}`} />
                <Label htmlFor={`cat-${root.slug}`} className="cursor-pointer text-[13px] font-medium text-foreground">
                  {root.name}
                </Label>
              </div>
              {root.children.length > 0 && (
                <div className="ml-6 space-y-2.5 border-l border-border pl-3">
                  {root.children.map((child) => (
                    <div key={child.id} className="flex items-center gap-2.5">
                      <RadioGroupItem value={child.slug} id={`cat-${child.slug}`} />
                      <Label htmlFor={`cat-${child.slug}`} className="cursor-pointer text-[13px] font-normal text-muted-foreground">
                        {child.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </RadioGroup>
      </section>

      {/* Brand — checkbox list */}
      <section aria-label="Brand filter" className="space-y-3 border-t border-border pt-6">
        <SectionLabel>Brand</SectionLabel>
        <div className="thin-scrollbar max-h-64 space-y-2.5 overflow-y-auto pr-1">
          {brands.map((brand) => (
            <div key={brand.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id={`brand-${brand.slug}`}
                  checked={selectedBrands.has(brand.slug)}
                  onCheckedChange={(checked) => toggleBrand(brand.slug, checked === true)}
                />
                <Label htmlFor={`brand-${brand.slug}`} className="cursor-pointer text-[13px] font-normal text-foreground">
                  {brand.name}
                </Label>
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground">{brand.productCount}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Price range */}
      <section aria-label="Price filter" className="space-y-3 border-t border-border pt-6">
        <SectionLabel>Price (₹)</SectionLabel>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Min"
            aria-label="Minimum price in rupees"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            className="h-9 rounded-md bg-card text-[13px]"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Max"
            aria-label="Maximum price in rupees"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            className="h-9 rounded-md bg-card text-[13px]"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={applyPrice} className="h-8 rounded-md px-4 text-xs">
          Apply price
        </Button>
      </section>

      {/* Resolution chips */}
      <section aria-label="Resolution filter" className="space-y-3 border-t border-border pt-6">
        <SectionLabel>Resolution</SectionLabel>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Resolution options">
          {RESOLUTIONS.map((res) => {
            const selected = selectedResolutions.has(res);
            return (
              <button
                key={res}
                type="button"
                onClick={() => toggleResolution(res)}
                aria-pressed={selected}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-foreground/30"
                }`}
              >
                {res}
              </button>
            );
          })}
        </div>
      </section>

      {/* Availability toggle */}
      <section aria-label="Availability filter" className="flex items-center justify-between border-t border-border pt-6">
        <Label htmlFor="availability-toggle" className="cursor-pointer">
          <span className="label-caps block">Availability</span>
          <span className="text-[13px] text-muted-foreground">In stock only</span>
        </Label>
        <Switch
          id="availability-toggle"
          checked={active.availability === "in-stock"}
          onCheckedChange={(checked) => navigate(active, { availability: checked ? "in-stock" : null })}
        />
      </section>

      {/* Rating */}
      <section aria-label="Rating filter" className="space-y-3 border-t border-border pt-6">
        <SectionLabel>Customer rating</SectionLabel>
        <RadioGroup
          value={active.minRating ?? ""}
          onValueChange={(v) => navigate(active, { minRating: v || null })}
        >
          {[
            { value: "", label: "Any rating" },
            { value: "4", label: "4★ & up" },
            { value: "3", label: "3★ & up" },
          ].map((opt) => (
            <div key={opt.value} className="flex items-center gap-2.5">
              <RadioGroupItem value={opt.value} id={`rating-${opt.value || "any"}`} />
              <Label htmlFor={`rating-${opt.value || "any"}`} className="cursor-pointer text-[13px] font-normal text-foreground">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </section>
    </div>
  );
}

/** Mobile filter entry — Sheet drawer with the same panel. */
export function MobileFilters({ tree, brands, active, resultCount }: FiltersPanelProps & { resultCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 rounded-md text-xs" aria-label="Open filters">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[320px] flex-col gap-0 overflow-y-auto p-6 sm:max-w-[320px]">
        <SheetHeader className="p-0 pb-2 text-left">
          <SheetTitle className="font-display text-lg">Filters</SheetTitle>
        </SheetHeader>
        <FiltersPanel tree={tree} brands={brands} active={active} />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Show {resultCount} result{resultCount === 1 ? "" : "s"}
        </button>
      </SheetContent>
    </Sheet>
  );
}

/** One removable active-filter chip (server-rendered href handled by parent). */
export function ActiveFilterChip({ label, removeLabel, href }: { label: string; removeLabel: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground transition-colors hover:border-foreground/30"
      aria-label={removeLabel}
    >
      {label}
      <X className="h-3 w-3 text-muted-foreground" aria-hidden />
    </Link>
  );
}
