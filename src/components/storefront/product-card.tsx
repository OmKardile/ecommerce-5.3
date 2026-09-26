"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCartStore } from "@/store/cart-store";
import { WishlistToggle } from "@/components/storefront/wishlist-toggle";
import { CompareToggle } from "@/components/storefront/compare-toggle";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ApiProductCard } from "@/lib/serializers";

interface ProductCardProps {
  product: ApiProductCard;
  priority?: boolean;
  className?: string;
  /** Server-computed: the signed-in customer has this product wishlisted. */
  wishlisted?: boolean;
}

export function ProductCard({ product, className, wishlisted = false }: ProductCardProps) {
  const add = useCartStore((s) => s.add);
  const { toast } = useToast();
  const image = product.images[0]?.url;
  const defaultVariant =
    product.variants.find((v) => v.inStock) ?? product.variants[0];
  const compareItem = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: image ?? null,
    priceFromPaise: product.priceFromPaise,
    brandName: product.brand.name,
  };

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!defaultVariant) return;
    const result = await add(defaultVariant.skuId, 1);
    if (result.ok) {
      toast({ title: "Added to cart", description: `${product.name} — ${defaultVariant.name}` });
    } else {
      toast({ title: "Could not add", description: result.error, variant: "destructive" });
    }
  }

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm",
        className
      )}
    > 
      <WishlistToggle productId={product.id} productName={product.name} initialAdded={wishlisted} variant="card" />
      <CompareToggle item={compareItem} variant="card" />
      <div className="relative aspect-square overflow-hidden bg-muted">
        {image ? (
           
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.discountPct > 0 && (
            <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
              {product.discountPct}% OFF
            </span>
          )}
          {!product.inStock && (
            <span className="rounded-sm bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold text-background">
              Out of stock
            </span>
          )}
          {product.inStock && product.availableStock <= 10 && (
            <span className="rounded-sm bg-card/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              Only {product.availableStock} left
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between">
          <span className="label-caps !text-[10px] !tracking-[0.16em]">{product.brand.name}</span>
          {product.ratingCount > 0 && product.ratingAvg !== null && (
            <span className="text-[11px] text-muted-foreground">★ {product.ratingAvg.toFixed(1)}</span>
          )}
        </div>
        <h3 className="line-clamp-2 min-h-[2.6em] text-[14px] font-medium leading-snug text-foreground">{product.name}</h3>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <div className="font-display text-lg leading-none">
              {formatINR(product.priceFromPaise)}
              {product.variants.length > 1 && <span className="ml-1 text-[11px] font-sans text-muted-foreground">onwards</span>}
            </div>
            {product.discountPct > 0 && (
              <div className="mt-1 text-[12px] text-muted-foreground">
                <s>{formatINR(product.mrpFromPaise)}</s>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!defaultVariant?.inStock}
            aria-label={`Add ${product.name} to cart`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Link>
  );
}