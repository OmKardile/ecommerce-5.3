"use client";

// Recently viewed — a localStorage ring buffer (`pn-recent-v1`) recorded by the
// PDP and read back as a horizontal strip. Reading goes through
// useSyncExternalStore so SSR renders nothing, hydration is safe, and the strip
// even syncs across tabs (storage event).
//
// Two surfaces:
//   <RecentlyViewed current={…} /> — PDP: records the current product + shows the previous ones.
//   <RecentlyViewedRail />         — home: read-only rail (hidden when the buffer is empty).

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Eraser } from "lucide-react";
import { formatINR } from "@/lib/money";

const STORAGE_KEY = "pn-recent-v1";
const CHANGE_EVENT = "pn-recent-changed";
const MAX_ITEMS = 8;

export interface RecentProductSnapshot {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  priceFromPaise: number;
}

interface StoredSnapshot extends RecentProductSnapshot {
  at: number;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getClientSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function parse(raw: string | null): StoredSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as StoredSnapshot[]).filter(
      (i) => i && typeof i.id === "string" && typeof i.slug === "string"
    );
  } catch {
    return [];
  }
}

/** Raw store read — shared by the recorder and both rails. */
function useRecentStored(): StoredSnapshot[] {
  const raw = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return useMemo(() => parse(raw), [raw]);
}

/** PDP recorder — ring buffer, newest first. */
function recordRecentProduct(current: RecentProductSnapshot) {
  try {
    let existing: StoredSnapshot[] = parse(getClientSnapshot());
    existing = existing.filter((i) => i.id !== current.id);
    const next: StoredSnapshot[] = [{ ...current, at: Date.now() }, ...existing].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full/blocked — strip simply won't persist */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Wipes the buffer; every mounted surface collapses via the change event. */
function clearRecentProducts() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function RecentCard({ item }: { item: StoredSnapshot }) {
  return (
    <li className="w-36 shrink-0 snap-start sm:w-40">
      <Link
        href={`/products/${item.slug}`}
        className="group block overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm"
      >
        <div className="aspect-square overflow-hidden bg-muted">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <div className="p-2.5">
          <h3 className="line-clamp-2 min-h-[2.4em] text-[12px] font-medium leading-snug text-foreground">
            {item.name}
          </h3>
          <p className="mt-1 font-display text-sm leading-none">{formatINR(item.priceFromPaise)}</p>
        </div>
      </Link>
    </li>
  );
}

function RailHeading({ count, onClear }: { count: number; onClear?: () => void }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <h2 className="font-display text-xl text-foreground">Recently viewed</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {count} item{count === 1 ? "" : "s"} · picks up where you left off
        </p>
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="press inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
        >
          <Eraser className="h-3.5 w-3.5" aria-hidden />
          Clear history
        </button>
      )}
    </div>
  );
}

/** PDP surface: records the current product, shows the previous ones. */
export function RecentlyViewed({ current }: { current: RecentProductSnapshot }) {
  const stored = useRecentStored();

  // Writing to localStorage then notifying the store keeps this effect setState-free.
  useEffect(() => {
    recordRecentProduct(current);
    // `stored` intentionally omitted — rewriting on every store change would loop.
  }, [current.id]);

  // Show only the *previous* products; the current one is on screen already.
  const items = stored.filter((i) => i.id !== current.id).slice(0, MAX_ITEMS - 1);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recently-viewed-heading" className="border-t border-border pt-8">
      <div id="recently-viewed-heading">
        <RailHeading count={items.length} onClear={clearRecentProducts} />
      </div>
      <ul className="thin-scrollbar mt-4 flex snap-x gap-4 overflow-x-auto pb-2">
        {items.map((item) => (
          <RecentCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

/** Home surface: read-only rail — renders nothing while the buffer is empty. */
export function RecentlyViewedRail() {
  const stored = useRecentStored();
  const items = stored.slice(0, MAX_ITEMS);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recently-viewed-rail-heading" className="rise-in border-t border-border pt-8">
      <div id="recently-viewed-rail-heading">
        <RailHeading count={items.length} onClear={clearRecentProducts} />
      </div>
      <ul className="thin-scrollbar mt-4 flex snap-x gap-4 overflow-x-auto pb-2">
        {items.map((item) => (
          <RecentCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
