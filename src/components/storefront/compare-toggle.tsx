"use client";

// Compare toggle — mirrors WishlistToggle's two variants: a floating chip on
// product-card imagery and a square button in the PDP buy row. Selection lives
// in localStorage; the floating tray + /compare page consume the same store.

import { useState } from "react";
import { Columns3, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { COMPARE_LIMIT, useCompareStore, type CompareItem } from "@/store/compare-store";

interface CompareToggleProps {
  item: CompareItem;
  variant?: "card" | "pdp";
}

export function CompareToggle({ item, variant = "card" }: CompareToggleProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const added = useCompareStore((s) => s.items.some((i) => i.id === item.id));
  const hydrated = useCompareStore((s) => s.hydrated);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const result = useCompareStore.getState().toggle(item);
    if (result === "full") {
      toast({
        title: `Compare is full (${COMPARE_LIMIT} products)`,
        description: "Remove a product from the compare tray first.",
        variant: "destructive",
      });
    } else if (result === "added") {
      toast({
        title: "Added to compare",
        description: `${item.brandName} · ${item.name}`,
      });
    }
    setBusy(false);
  }

  const label = added ? `Remove ${item.name} from compare` : `Add ${item.name} to compare`;

  if (variant === "pdp") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={added}
        aria-label={label}
        title={added ? "In compare" : "Add to compare"}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors",
          added
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-foreground/60 hover:border-primary/50 hover:text-primary"
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Columns3 className={cn("h-4 w-4", added && "fill-current")} aria-hidden />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={hydrated ? added : false}
      aria-label={label}
      className={cn(
        "absolute right-3 top-[52px] z-10 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur transition-colors hover:bg-card disabled:opacity-60",
        added ? "text-primary" : "text-foreground/35 hover:text-primary"
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Columns3 className={cn("h-3.5 w-3.5", added && "fill-current")} aria-hidden />
      )}
    </button>
  );
}
