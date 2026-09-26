"use client";

// Cart view — editorial line items + summary. Server cart is the source of truth;
// the zustand store mirrors it for optimistic UI.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Minus, Plus, ShieldCheck, Trash2, Truck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useCartStore, type CartLine } from "@/store/cart-store";
import { formatINR } from "@/lib/money";
import { FREE_SHIPPING_THRESHOLD_PAISE } from "@/lib/constants";
import { CartCouponBox, readAppliedCoupon, type AppliedCoupon } from "@/components/storefront/cart-coupon-box";
import { toast } from "@/hooks/use-toast";

function LineImage({ line }: { line: CartLine }) {
  if (line.image) {
    return (
      <img
        src={line.image}
        alt={line.productName}
        loading="lazy"
        className="h-20 w-20 shrink-0 rounded-md border border-border object-cover sm:h-24 sm:w-24"
      />
    );
  }
  return <div className="h-20 w-20 shrink-0 rounded-md border border-border bg-muted sm:h-24 sm:w-24" aria-hidden />;
}

function CartRow({ line }: { line: CartLine }) {
  const update = useCartStore((s) => s.update);
  const remove = useCartStore((s) => s.remove);
  const [qtyBusy, setQtyBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function changeQty(next: number) {
    if (qtyBusy || next === line.quantity) return;
    if (next < 1) {
      await removeItem();
      return;
    }
    setQtyBusy(true);
    const res = await update(line.skuId, next);
    if (!res.ok) {
      toast({ title: "Quantity not updated", description: res.error ?? "Not enough stock.", variant: "destructive" });
    }
    setQtyBusy(false);
  }

  async function removeItem() {
    setRemoving(true);
    await remove(line.skuId);
    setRemoving(false);
  }

  const maxQty = Math.max(line.availableStock, 0);

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex gap-4 py-5"
    >
      <Link href={`/products/${line.productSlug}`} className="shrink-0" aria-label={line.productName}>
        <LineImage line={line} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <Link href={`/products/${line.productSlug}`} className="link-underline font-medium leading-snug hover:text-primary">
              {line.productName}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {line.variantName} · SKU <span className="font-mono">{line.skuCode}</span>
            </p>
          </div>
          <p className="font-display text-base whitespace-nowrap tabular-nums">{formatINR(line.lineTotalPaise)}</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-md border border-border" role="group" aria-label={`Quantity for ${line.productName}`}>
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => void changeQty(line.quantity - 1)}
                disabled={qtyBusy || removing || !line.inStock}
                className="press flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-9 text-center text-sm font-medium tabular-nums" aria-live="polite">
                {qtyBusy ? "…" : line.quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => void changeQty(line.quantity + 1)}
                disabled={qtyBusy || removing || !line.inStock || line.quantity >= maxQty}
                className="press flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatINR(line.unitPricePaise)} <span className="text-[10px]">/ unit · incl. GST</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!line.inStock ? (
              <span className="text-xs font-medium text-destructive">Not available</span>
            ) : line.quantity >= maxQty ? (
              <span className="text-xs text-muted-foreground">Max {maxQty} in stock</span>
            ) : null}
            <button
              type="button"
              onClick={() => void removeItem()}
              disabled={removing}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
              aria-label={`Remove ${line.productName} from cart`}
            >
              {removing ? <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
              Remove
            </button>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

export function CartView() {
  const cart = useCartStore((s) => s.cart);
  const loaded = useCartStore((s) => s.loaded);
  const refresh = useCartStore((s) => s.refresh);
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [codEligible, setCodEligible] = useState<{ eligible: boolean; reason?: string } | null>(null);

  useEffect(() => {
    if (!loaded) void refresh();
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setApplied(readAppliedCoupon());
    });
    return () => {
      cancelled = true;
    };
  }, [loaded, refresh]);

  // COD eligibility comes from the cart API envelope: { cart, cod: { eligible, reason? } }
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/cart", { cache: "no-store" });
        const json = (await res.json()) as { ok: boolean; data?: { cod?: { eligible: boolean; reason?: string } } };
        if (!cancelled && json.ok && json.data?.cod) setCodEligible(json.data.cod);
      } catch {
        // hint only — ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cart.itemCount, cart.subtotalPaise]);

  const savings = useMemo(() => Math.max(cart.mrpTotalPaise - cart.subtotalPaise, 0), [cart.mrpTotalPaise, cart.subtotalPaise]);
  const payableAfterCoupon = Math.max(cart.subtotalPaise - cart.bundleDiscountPaise - (applied?.discountPaise ?? 0), 0);

  if (!loaded) {
    return (
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-4 py-4">
              <Skeleton className="h-24 w-24 rounded-md" />
              <div className="flex-1 space-y-3 py-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-8 w-40" />
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-4">
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center sm:py-24">
        <p className="label-caps mb-4">Your cart</p>
        <h2 className="font-display text-3xl sm:text-4xl">Nothing specified yet.</h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          Browse cameras, recorders, cable and optical hardware — every SKU is serial-tracked, GST-invoiced and dispatched from Surat within one business day.
        </p>
        <Button asChild className="mt-8 h-11 px-6">
          <Link href="/products">
            Browse the catalogue <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
      {/* lines */}
      <div className="lg:col-span-7 xl:col-span-8">
        {cart.hasOutOfStock && (
          <div role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            One or more items in your cart are no longer available in the requested quantity. Remove them or adjust the quantity before checkout.
          </div>
        )}

        <ul className="divide-y divide-border">
          {cart.lines.map((line) => (
            <CartRow key={line.skuId} line={line} />
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"} · dispatch cut-off 4:00 PM IST (Mon–Sat)
          </span>
          <Link href="/products" className="link-underline font-medium text-foreground">
            Continue browsing →
          </Link>
        </div>
      </div>

      {/* summary */}
      <aside className="lg:col-span-5 xl:col-span-4" aria-label="Order summary">
        <div className="lg:sticky lg:top-24">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-display text-xl">Summary</h2>

            {/* free-shipping progress — mirrors checkout's threshold math */}
            <div
              className={`mt-4 rounded-lg border p-3.5 ${
                cart.subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE
                  ? "border-primary/30 bg-primary/[0.05]"
                  : "border-border bg-muted/50"
              }`}
              role="status"
            >
              {cart.subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE ? (
                <p className="flex items-center gap-2 text-[13px] font-medium text-primary">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Free shipping unlocked — this cart ships free across India.
                </p>
              ) : (
                <>
                  <p className="flex items-center justify-between gap-2 text-[13px] font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Truck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      Add {formatINR(FREE_SHIPPING_THRESHOLD_PAISE - cart.subtotalPaise)} more
                    </span>
                    <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                      {Math.min(100, Math.floor((cart.subtotalPaise / FREE_SHIPPING_THRESHOLD_PAISE) * 100))}%
                    </span>
                  </p>
                  <div
                    className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border"
                    role="progressbar"
                    aria-label="Progress toward free shipping"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, Math.floor((cart.subtotalPaise / FREE_SHIPPING_THRESHOLD_PAISE) * 100))}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                      style={{ width: `${Math.min(100, (cart.subtotalPaise / FREE_SHIPPING_THRESHOLD_PAISE) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    for free shipping · free above {formatINR(FREE_SHIPPING_THRESHOLD_PAISE)} · pan-India delivery
                  </p>
                </>
              )}
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal ({cart.itemCount} items)</span>
                <span className="font-medium tabular-nums">{formatINR(cart.subtotalPaise)}</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Savings vs MRP</span>
                  <span className="font-medium tabular-nums">− {formatINR(savings)}</span>
                </div>
              )}
              {cart.bundleApplied && cart.bundleDiscountPaise > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Kit bundle · {cart.bundleApplied.name} (−{cart.bundleApplied.discountPct}%)
                  </span>
                  <span className="font-medium text-primary">− {formatINR(cart.bundleDiscountPaise)}</span>
                </div>
              )}
              {applied && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coupon {applied.code}</span>
                  <span className="font-medium text-primary">− {formatINR(applied.discountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="text-muted-foreground">Calculated at checkout</span>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Estimated total</span>
              <span className="font-display text-2xl tabular-nums">{formatINR(payableAfterCoupon)}</span>
            </div>
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              incl. {formatINR(cart.gstAmountPaise)} GST · taxable value {formatINR(cart.taxableBasePaise)}
            </p>

            <div className="mt-5">
              <CartCouponBox subtotalPaise={cart.subtotalPaise} applied={applied} onChange={setApplied} />
            </div>

            {codEligible && !codEligible.eligible && codEligible.reason && (
              <p className="mt-4 flex items-start gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {codEligible.reason}
              </p>
            )}
            {codEligible?.eligible && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden /> Cash on Delivery available for this cart (up to ₹15,000, fee applies).
              </p>
            )}

            <Button asChild className="mt-5 h-12 w-full text-base" disabled={cart.hasOutOfStock}>
              <Link href="/checkout">
                Proceed to checkout <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            {cart.hasOutOfStock && (
              <p className="mt-2 text-center text-xs text-destructive">Resolve out-of-stock items to continue.</p>
            )}

            <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> Genuine stock with serial-tracked warranty
              </p>
              <p className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-primary" aria-hidden /> Pan-India delivery via Delhivery &amp; Shiprocket
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
