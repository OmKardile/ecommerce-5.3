"use client";

// Floating compare tray — appears once ≥1 product is selected. Lives in the
// storefront layout; hides itself on /compare and during checkout-style flows.
// Thumbnails come from the persisted snapshots, so no fetches are needed.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Columns3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompareStore } from "@/store/compare-store";

const HIDDEN_PREFIXES = ["/compare", "/checkout", "/order-success", "/account"];

export function CompareTray() {
  const pathname = usePathname();
  const items = useCompareStore((s) => s.items);
  const hydrated = useCompareStore((s) => s.hydrated);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);

  const hidden = !hydrated || items.length === 0 || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  const ready = items.length >= 2;
  const href = `/compare?ids=${items.map((i) => i.id).join(",")}`;

  return (
    <div
      aria-hidden={hidden}
      className="pointer-events-none fixed inset-x-0 bottom-[5.25rem] z-40 flex justify-center px-3 sm:bottom-4 sm:px-0"
    >
      <AnimatePresence>
        {!hidden && (
          <motion.div
            initial={{ y: 72, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 72, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            role="region"
            aria-label="Compare selection tray"
            className="pointer-events-auto w-full sm:w-auto"
          >
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card/95 py-2 pl-3 pr-2 shadow-lg shadow-foreground/10 backdrop-blur sm:pl-4">
            <span className="label-caps hidden !text-[10px] text-muted-foreground sm:block">Compare</span>

            <div className="flex -space-x-2">
              {items.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => remove(i.id)}
                  aria-label={`Remove ${i.name} from compare`}
                  title={`Remove ${i.name}`}
                  className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted ring-2 ring-card transition-transform hover:z-10 hover:scale-105"
                >
                  {i.imageUrl ? (
                    <img src={i.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[9px] text-muted-foreground">—</span>
                  )}
                  <span className="absolute inset-0 hidden items-center justify-center bg-foreground/60 group-hover:flex">
                    <X className="h-3.5 w-3.5 text-background" aria-hidden />
                  </span>
                </button>
              ))}
            </div>

            <div className="hidden text-[11px] leading-tight text-muted-foreground sm:block">
              <span className="font-medium text-foreground">{items.length}</span> of 4 selected
            </div>

            <Link
              href={href}
              aria-disabled={!ready}
              onClick={(e) => {
                if (!ready) e.preventDefault();
              }}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors",
                ready
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed bg-muted text-muted-foreground"
              )}
            >
              <Columns3 className="h-3.5 w-3.5" aria-hidden />
              {ready ? "Compare now" : "Pick 2 to compare"}
            </Link>

            <button
              type="button"
              onClick={clear}
              aria-label="Clear compare selection"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
