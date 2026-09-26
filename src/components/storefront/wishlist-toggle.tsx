"use client";

// Wishlist heart toggle — POST /api/wishlist/[productId] flips membership.
// Two visual variants: a floating chip over product-card imagery and a square
// button beside the PDP buy actions. 401 → prompt to sign in, never a fake save.

import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WishlistToggleProps {
  productId: string;
  productName: string;
  /** Server-computed membership for the signed-in customer. */
  initialAdded: boolean;
  variant?: "card" | "pdp";
}

export function WishlistToggle({ productId, productName, initialAdded, variant = "card" }: WishlistToggleProps) {
  const { toast } = useToast();
  const [added, setAdded] = useState(initialAdded);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/wishlist/${encodeURIComponent(productId)}`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: { added?: boolean }; error?: string };
      if (res.status === 401) {
        toast({ title: "Sign in to save", description: "Log in with your mobile number to keep products on your wishlist." });
        return;
      }
      if (!res.ok || !json.ok) {
        toast({ title: "Could not update wishlist", description: json.error ?? "Try again in a moment.", variant: "destructive" });
        return;
      }
      setAdded(Boolean(json.data?.added));
      toast({
        title: json.data?.added ? "Saved to wishlist" : "Removed from wishlist",
        description: json.data?.added ? productName : undefined,
      });
    } catch {
      toast({ title: "Network error", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (variant === "pdp") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={added}
        aria-label={added ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
        title={added ? "Saved to wishlist" : "Save to wishlist"}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors",
          added
            ? "border-accent bg-accent/10 text-accent"
            : "border-border bg-card text-foreground/60 hover:border-accent/50 hover:text-accent"
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Heart className={cn("h-4 w-4", added && "fill-current")} aria-hidden />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={added}
      aria-label={added ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      className={cn(
        "absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur transition-colors hover:bg-card disabled:opacity-60",
        added ? "text-accent" : "text-foreground/35 hover:text-accent"
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Heart className={cn("h-3.5 w-3.5", added && "fill-current")} aria-hidden />
      )}
    </button>
  );
}
