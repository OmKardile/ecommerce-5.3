"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, ShoppingCart, User, Menu, X, Heart, Phone, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCartCount } from "@/store/cart-store";
import { cn } from "@/lib/utils";

interface QuickHit {
  id: string;
  slug: string;
  name: string;
  brand: string;
  modelNumber: string | null;
  priceFromPaise: number;
  image: string | null;
}

const NAV = [
  { href: "/products?category=cctv-surveillance", label: "CCTV & Surveillance" },
  { href: "/products?category=displays-screens", label: "Screens" },
  { href: "/products?category=cables-wiring", label: "Cable" },
  { href: "/products?category=connectors-accessories", label: "Connector" },
  { href: "/products?category=media-converters-optical", label: "Converter" },
  { href: "/kit-builder", label: "Kit Builder" },
  { href: "/brands", label: "Brands" },
];

function formatPrice(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<QuickHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/quick?q=${encodeURIComponent(term)}`);
        const json = (await res.json()) as { ok: boolean; data?: { hits: QuickHit[] } };
        setHits(json.ok && json.data ? json.data.hits : []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            setOpen(false);
            onNavigate?.();
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
          }
        }}
        role="search"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          placeholder="Search cameras, DVRs, cables, SKU…"
          aria-label="Search products"
          className="h-10 rounded-full border-border bg-card pl-10 pr-10 text-sm"
        />
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setHits([]);
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>
      {open && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {loading && hits.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground">Searching…</div>}
          {!loading && hits.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground">No products matched &ldquo;{query}&rdquo;</div>}
          {hits.map((hit) => (
            <Link
              key={hit.id}
              href={`/products/${hit.slug}`}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="flex items-center gap-3 border-b border-border/70 px-3 py-2.5 last:border-0 hover:bg-muted"
            >
              {hit.image ? (
                 
                <img src={hit.image} alt="" className="h-10 w-10 rounded-md object-cover" loading="lazy" />
              ) : (
                <div className="h-10 w-10 rounded-md bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{hit.name}</div>
                <div className="text-xs text-muted-foreground">
                  {hit.brand}
                  {hit.modelNumber ? ` · ${hit.modelNumber}` : ""}
                </div>
              </div>
              <div className="font-display text-sm">{formatPrice(hit.priceFromPaise)}</div>
            </Link>
          ))}
          {hits.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
              }}
              className="w-full bg-muted/60 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted"
            >
              View all results →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const count = useCartCount();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      {/* announcement bar */}
      <div className="bg-brand text-brand-foreground">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-4 text-[11px] tracking-wide sm:px-6">
          <p className="truncate">Same-day dispatch on orders confirmed before 4:00 PM IST (Mon–Sat) · Pan-India delivery</p>
          <a href="tel:+919876543210" className="hidden items-center gap-1.5 sm:flex hover:underline">
            <Phone className="h-3 w-3" /> +91 98765 43210
          </a>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:h-[72px]">
        {/* wordmark */}
        <Link href="/" className="group flex shrink-0 flex-col leading-none">
          <span className="font-display text-[22px] font-semibold tracking-tight text-foreground lg:text-2xl">
            Patel Networks
          </span>
          <span className="label-caps !text-[9px] !tracking-[0.32em] text-muted-foreground group-hover:text-primary">
            SURVEILLANCE · NETWORKING
          </span>
        </Link>

        {/* desktop nav */}
        <nav aria-label="Primary" className="ml-4 hidden flex-1 items-center gap-5 xl:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "link-underline whitespace-nowrap text-[13px] font-medium text-foreground/80 hover:text-foreground",
                pathname === item.href.split("?")[0] && "text-primary"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* search */}
        <div className="ml-auto hidden w-64 lg:block xl:w-72">
          <SearchBox />
        </div>

        {/* actions */}
        <div className="flex items-center gap-1">
          {/* Standalone icon toggle lives on ≥sm rows; below sm it moves into the
              menu drawer (labeled row) so the 375px actions row never overflows. */}
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Wishlist">
            <Link href="/account/wishlist">
              <Heart className="h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Account">
            <Link href="/account">
              <User className="h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="relative" aria-label={`Cart (${count} items)`}>
            <Link href="/cart">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          </Button>

          {/* mobile drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto p-0">
              <SheetTitle className="border-b border-border px-5 py-4 font-display text-lg">
                Patel Networks
              </SheetTitle>
              <div className="px-5 py-4">
                <SearchBox onNavigate={() => setMobileOpen(false)} />
              </div>
              <nav aria-label="Mobile" className="flex flex-col pb-6">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between border-b border-border/60 px-5 py-3 text-sm font-medium hover:bg-muted"
                  >
                    {item.label}
                    <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
                  </Link>
                ))}
                <div className="mt-4 flex flex-col gap-1 px-5">
                  <Link href="/account" onClick={() => setMobileOpen(false)} className="py-2 text-sm text-muted-foreground hover:text-foreground">
                    My Account
                  </Link>
                  <Link href="/track" onClick={() => setMobileOpen(false)} className="py-2 text-sm text-muted-foreground hover:text-foreground">
                    Track Order
                  </Link>
                  <Link href="/contact" onClick={() => setMobileOpen(false)} className="py-2 text-sm text-muted-foreground hover:text-foreground">
                    B2B / Wholesale Desk
                  </Link>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border/60 px-5 pt-4">
                  <span className="text-sm text-muted-foreground">Appearance</span>
                  <ThemeToggle />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* secondary category rail (tablet & below desktop-nav) */}
      <nav aria-label="Categories" className="border-t border-border/70 xl:hidden">
        <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-4 py-2 text-[13px] sm:px-6">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap font-medium text-foreground/75 hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
