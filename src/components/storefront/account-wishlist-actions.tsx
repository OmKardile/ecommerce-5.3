"use client";

// Wishlist row actions — remove from wishlist and add the first in-stock SKU to the cart.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingCart, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart-store";
import { toast } from "@/hooks/use-toast";

export function WishlistActions({
  productId,
  productName,
  skuId,
  inStock,
}: {
  productId: string;
  productName: string;
  skuId: string | null;
  inStock: boolean;
}) {
  const router = useRouter();
  const addToCart = useCartStore((s) => s.add);
  const [busy, setBusy] = useState<"cart" | "remove" | null>(null);

  async function remove() {
    setBusy("remove");
    try {
      const res = await fetch(`/api/wishlist/${productId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Removed from wishlist", description: productName });
        router.refresh();
      } else {
        toast({ title: "Could not remove", variant: "destructive" });
      }
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    if (!skuId) return;
    setBusy("cart");
    const res = await addToCart(skuId, 1);
    if (res.ok) {
      toast({ title: "Added to cart", description: productName });
    } else {
      toast({ title: "Could not add", description: res.error, variant: "destructive" });
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        className="h-9"
        onClick={() => void add()}
        disabled={!skuId || !inStock || busy !== null}
      >
        {busy === "cart" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShoppingCart className="h-4 w-4" aria-hidden />}
        {inStock ? "Add to cart" : "Out of stock"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 text-muted-foreground hover:text-destructive"
        onClick={() => void remove()}
        disabled={busy !== null}
        aria-label={`Remove ${productName} from wishlist`}
      >
        {busy === "remove" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
        Remove
      </Button>
    </div>
  );
}
