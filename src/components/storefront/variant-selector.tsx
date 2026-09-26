"use client";

// PDP variant matrix — one chip group per attribute key; chips narrow to the exact SKU.
// Also exports the mobile sticky purchase bar.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CreditCard, Minus, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WishlistToggle } from "@/components/storefront/wishlist-toggle";
import { CompareToggle } from "@/components/storefront/compare-toggle";
import { useToast } from "@/hooks/use-toast";
import { useCartStore } from "@/store/cart-store";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ApiProductCard, ApiProductVariant } from "@/lib/serializers";

interface VariantSelectorProps {
  product: ApiProductCard;
  /** Server-computed: the signed-in customer has this product wishlisted. */
  initialWishlisted?: boolean;
}

function matchesSelection(variant: ApiProductVariant, selection: Record<string, string>): boolean {
  return Object.entries(selection).every(([key, value]) => variant.attributes[key] === value);
}

export function VariantSelector({ product, initialWishlisted = false }: VariantSelectorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const add = useCartStore((s) => s.add);

  const variants = product.variants;

  // Attribute keys in stable order (as derived by the serializer from variant attributes)
  const attributeKeys = product.attributes;

  // Preselect the first in-stock variant (or the first variant) so selection is always complete
  const defaultVariant = variants.find((v) => v.inStock) ?? variants[0];
  const [selection, setSelection] = useState<Record<string, string>>(() => defaultVariant?.attributes ?? {});
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  const selectedVariant = useMemo(
    () => variants.find((v) => matchesSelection(v, selection)),
    [variants, selection]
  );

  function selectChip(key: string, value: string) {
    // Change the clicked attribute, then resolve the full combination to the best
    // real variant: prefer maximal overlap with the current selection, in-stock first.
    // (Cross-attribute jumps must stay possible — e.g. 2MP pairs with a 3.6mm lens
    // while the current selection holds 2.8mm — otherwise OOS variants become
    // unreachable and the notify-me flow dead-ends.)
    const candidates = variants.filter((v) => v.attributes[key] === value);
    const current = selection;
    const overlap = (v: ApiProductVariant) =>
      Object.entries(current).filter(([k, val]) => k !== key && v.attributes[k] === val).length;
    const best =
      candidates.filter((v) => v.inStock).sort((a, b) => overlap(b) - overlap(a))[0] ??
      candidates.sort((a, b) => overlap(b) - overlap(a))[0] ??
      null;
    setSelection((prev) => ({ ...prev, [key]: value, ...(best ? best.attributes : {}) }));
    setQty(1);
  }

  async function addToCart(): Promise<boolean> {
    if (!selectedVariant) return false;
    setAdding(true);
    try {
      const result = await add(selectedVariant.skuId, qty);
      if (!result.ok) {
        toast({ title: "Could not add to cart", description: result.error, variant: "destructive" });
        return false;
      }
      toast({
        title: "Added to cart",
        description: `${product.name} — ${selectedVariant.name}${qty > 1 ? ` × ${qty}` : ""}`,
      });
      return true;
    } finally {
      setAdding(false);
    }
  }

  async function buyNow() {
    const ok = await addToCart();
    if (ok) router.push("/checkout");
  }

  if (!variants.length || !defaultVariant) {
    return (
      <p className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        Variants for this item are being updated — please call the counter to order.
      </p>
    );
  }

  const stock = selectedVariant?.availableStock ?? 0;
  const inStock = (selectedVariant?.inStock ?? false) && stock > 0;
  const lowStock = inStock && (selectedVariant?.lowStock ?? false);
  const maxQty = stock > 0 ? Math.min(stock, 99) : 99;

  return (
    <div className="space-y-6">
      {/* Attribute chip groups */}
      {attributeKeys.map((key) => {
        const values = [...new Set(variants.map((v) => v.attributes[key]).filter(Boolean))];
        return (
          <div key={key} role="group" aria-label={`Choose ${key}`} className="space-y-2">
            <p className="label-caps">
              {key}
              <span className="ml-2 font-sans text-[11px] normal-case tracking-normal text-muted-foreground">
                {selection[key] ?? "—"}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                const hypothetical = { ...selection, [key]: value };
                const valueExists = variants.some((v) => v.attributes[key] === value);
                const hasMatch = variants.some((v) => matchesSelection(v, hypothetical));
                const selected = selection[key] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => selectChip(key, value)}
                    disabled={!valueExists}
                    aria-pressed={selected}
                    aria-label={`${key}: ${value}${hasMatch ? "" : " (adjusts other options to the nearest match)"}`}
                    className={cn(
                      "rounded-md border px-3.5 py-2 text-[13px] font-medium transition-all duration-200",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : hasMatch
                          ? "border-border bg-card text-foreground hover:border-foreground/40"
                          : "border-border bg-muted/50 text-muted-foreground hover:border-foreground/30 hover:text-foreground/80"
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Selected SKU panel */}
      {selectedVariant && (
        <div className="space-y-3 border-t border-border pt-5" aria-live="polite">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-3xl leading-none">{formatINR(selectedVariant.sellingPricePaise)}</span>
            {selectedVariant.discountPct > 0 && (
              <>
                <s className="text-sm text-muted-foreground">{formatINR(selectedVariant.mrpPaise)}</s>
                <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                  {selectedVariant.discountPct}% off
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
            <span className="text-muted-foreground">
              SKU <span className="font-mono text-[12px] text-foreground">{selectedVariant.skuCode}</span>
            </span>
            {inStock && !lowStock && <span className="font-medium text-primary">In stock</span>}
            {lowStock && (
              <Badge variant="outline" className="rounded-sm border-accent/50 bg-accent/10 px-1.5 py-0 text-[11px] font-semibold text-accent-foreground">
                Low stock · only {stock} left
              </Badge>
            )}
            {!inStock && <span className="font-medium text-destructive">Out of stock</span>}
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {product.warrantyMonths}-month warranty
            </span>
            {!product.isCodAllowed && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5" aria-hidden />
                Prepaid only
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quantity + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 items-center rounded-md border border-border bg-card" role="group" aria-label="Quantity">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="Decrease quantity"
            className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:text-accent disabled:opacity-30"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <input
            type="text"
            inputMode="numeric"
            aria-label="Quantity"
            value={qty}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
              if (Number.isNaN(n)) return;
              setQty(Math.max(1, Math.min(maxQty, n)));
            }}
            className="h-full w-10 border-x border-border bg-transparent text-center text-sm tabular-nums outline-none"
          />
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty}
            aria-label="Increase quantity"
            className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:text-accent disabled:opacity-30"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <Button
          type="button"
          onClick={addToCart}
          disabled={!inStock || adding}
          className="h-11 min-w-[140px] flex-1 rounded-md px-6 text-sm sm:flex-none"
        >
          {adding ? "Adding…" : "Add to cart"}
        </Button>
        <Button
          type="button"
          onClick={buyNow}
          disabled={!inStock || adding}
          variant="outline"
          className="h-11 min-w-[120px] rounded-md border-foreground/70 px-6 text-sm hover:bg-foreground hover:text-background"
        >
          Buy now
        </Button>
        <WishlistToggle productId={product.id} productName={product.name} initialAdded={initialWishlisted} variant="pdp" />
        <CompareToggle
          item={{
            id: product.id,
            slug: product.slug,
            name: product.name,
            imageUrl: product.images[0]?.url ?? null,
            priceFromPaise: product.priceFromPaise,
            brandName: product.brand.name,
          }}
          variant="pdp"
        />
      </div>

      {selectedVariant && !inStock && <NotifyMeInline skuId={selectedVariant.skuId} />}
    </div>
  );
}

/** Back-in-stock capture — shown under the buy actions when the selected SKU is out of stock. */
function NotifyMeInline({ skuId }: { skuId: string }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    const digits = phone.replace(/[\s-]/g, "");
    if (!/^(\+91)?[6-9]\d{9}$/.test(digits)) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/stock-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuId, phone: digits }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; data?: { message?: string; alreadyInStock?: boolean } };
      if (!res.ok || !json.ok) {
        toast({ title: "Could not save request", description: json.error ?? "Try again in a few minutes.", variant: "destructive" });
        return;
      }
      if (json.data?.alreadyInStock) {
        toast({ title: "Back in stock", description: json.data.message });
        return;
      }
      setDone(true);
      toast({ title: "You are on the list", description: json.data?.message });
    } catch {
      toast({ title: "Network error", description: "Try again in a few minutes.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground" role="status">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          Watching this SKU — we will WhatsApp you the moment it is back. Meanwhile, a similar variant above may be in stock.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/40 px-4 py-3">
      <label htmlFor="notify-phone" className="flex items-center gap-1.5 text-[13px] font-medium text-foreground/90">
        <BellRing className="h-4 w-4 text-primary" aria-hidden /> Out of stock — get notified when it returns
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="notify-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="WhatsApp number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="h-10 w-full max-w-56 rounded-md border border-border bg-card px-3 text-sm outline-none transition-colors focus:border-primary/60"
        />
        <Button type="button" variant="outline" onClick={submit} disabled={busy} className="h-10">
          {busy ? "Saving…" : "Notify me"}
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">One message when the SKU lands back in stock — no marketing.</p>
    </div>
  );
}

/** Mobile sticky purchase bar — fixed bottom, small screens only. */
export function PdpStickyBar({ product }: { product: ApiProductCard }) {
  const { toast } = useToast();
  const add = useCartStore((s) => s.add);
  const [busy, setBusy] = useState(false);

  const variant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  if (!variant) return null;

  async function handleAdd() {
    if (!variant) return;
    setBusy(true);
    try {
      const result = await add(variant.skuId, 1);
      if (result.ok) {
        toast({ title: "Added to cart", description: `${product.name} — ${variant.name}` });
      } else {
        toast({ title: "Could not add", description: result.error, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="font-display text-lg leading-none">
            {formatINR(variant.sellingPricePaise)}
            {product.variants.length > 1 && (
              <span className="ml-1 font-sans text-[11px] text-muted-foreground">onwards</span>
            )}
          </p>
          <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-muted-foreground">{product.name}</p>
        </div>
        <Button
          type="button"
          onClick={handleAdd}
          disabled={!variant.inStock || busy}
          className="h-10 rounded-md px-6 text-sm"
        >
          {busy ? "Adding…" : variant.inStock ? "Add to cart" : "Out of stock"}
        </Button>
      </div>
    </div>
  );
}
