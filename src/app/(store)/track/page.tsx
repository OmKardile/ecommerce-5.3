"use client";

// Track order — public lookup. Two modes:
//  1. order number + delivery phone  -> full tracking projection (privacy-preserving)
//  2. phone only                     -> minimal "my orders" index; pick one to drill in
// No sign-in needed. The phone number is the shared secret for both modes.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Loader2,
  PackageSearch,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrackingTimeline } from "@/components/storefront/tracking-timeline";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { localPhoneFromInput } from "@/lib/phone";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";

interface TrackResult {
  mode: "detail";
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string | null;
  placedAt: string;
  estimatedDeliveryAt: string | null;
  contactPhone: string;
  items: { name: string; variant: string; quantity: number }[];
  return: { status: string; createdAt: string } | null;
  shipment: {
    courier: string | null;
    awb: string | null;
    trackingUrl: string | null;
    status: string | null;
    events: { status: string; location: string | null; occurredAt: string }[];
  } | null;
  statusHistory: { status: string; comment: string | null; at: string }[];
}

interface TrackListItem {
  orderNumber: string;
  status: string;
  paymentMethod: string;
  placedAt: string;
  estimatedDeliveryAt: string | null;
  itemCount: number;
  returnStatus: string | null;
}

const RETURN_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Return requested",
  APPROVED: "Return approved — ship it back",
  REJECTED: "Return request declined",
  RESTOCKED: "Return received & restocked",
  REFUNDED: "Refund completed",
};

// Single tone map shared by list chips + detail badge so a status reads the same everywhere.
const STATUS_TONE: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  COD_PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PAID: "bg-primary/10 text-primary",
  CONFIRMED: "bg-primary/10 text-primary",
  PROCESSING: "bg-primary/10 text-primary",
  PACKED: "bg-primary/10 text-primary",
  SHIPPED: "bg-accent/15 text-accent-foreground",
  OUT_FOR_DELIVERY: "bg-accent/15 text-accent-foreground",
  DELIVERED: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  CANCELLED: "bg-destructive/10 text-destructive",
  RETURN_REQUESTED: "bg-muted text-foreground",
  RETURNED: "bg-muted text-foreground",
  REFUNDED: "bg-muted text-foreground",
};

function StatusChip({ status, className }: { status: string; className?: string }) {
  const label =
    ORDER_STATUS_LABELS[status as OrderStatus] ?? status.replaceAll("_", " ").toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium tracking-wide",
        STATUS_TONE[status] ?? "bg-muted text-foreground",
        className
      )}
    >
      {label}
    </span>
  );
}

function ReturnChip({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
      <RotateCcw className="h-3 w-3" aria-hidden />
      {RETURN_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function isPhoneUsable(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  // 10-digit local number, optionally prefixed with 91
  return /^\d{10}$/.test(digits) || /^91\d{10}$/.test(digits);
}

export default function TrackPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [list, setList] = useState<TrackListItem[] | null>(null);
  const drillRef = useRef<HTMLInputElement>(null);

  // Deep-link support: /track?order=PN-2026-000123 prefills the order field
  // (used by the /order-success rescue page and account order links).
  useEffect(() => {
    const pre = new URLSearchParams(window.location.search).get("order");
    if (pre) setOrderNumber(pre.trim().toUpperCase());
  }, []);

  async function lookup(overrideOrderNumber?: string) {
    if (loading) return;
    const num = (overrideOrderNumber ?? orderNumber).trim().toUpperCase();
    if (!isPhoneUsable(phone)) {
      setError("Enter the 10-digit mobile number used on the order.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setList(null);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: num, phone }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: (TrackResult & { mode: string }) | { mode: "list"; orders: TrackListItem[] };
      };
      if (json.ok && json.data) {
        if (json.data.mode === "list") {
          const l = json.data as { mode: "list"; orders: TrackListItem[] };
          if (l.orders.length === 0) {
            setError(
              "No orders found for that mobile in the last 6 months. Placed the order with a different number?"
            );
          } else {
            setList(l.orders);
          }
        } else {
          setResult(json.data as TrackResult);
        }
      } else {
        const friendly =
          res.status === 404
            ? "We could not find an order with that number. Double-check it — the format is PN-YYYY-NNNNNN."
            : res.status === 403
              ? "That mobile number does not match this order. Try the number the order was placed with."
              : json.error ?? "Lookup failed — try again in a moment.";
        setError(friendly);
      }
    } catch {
      setError("Network error — please retry.");
      toast({ title: "Lookup failed", description: "Network error, please retry.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function drillInto(orderNumber: string) {
    setOrderNumber(orderNumber);
    void lookup(orderNumber);
    // bring the fresh detail into view
    window.setTimeout(() => drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-8">
        <p className="label-caps mb-2">Order tracking</p>
        <h1 className="font-display text-3xl sm:text-4xl">Where is my hardware?</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Track by order number and the mobile on the order — or leave the order number empty to list
          everything booked on that mobile. Signed-in customers can also track from{" "}
          <Link href="/account/orders" className="link-underline text-foreground">
            Account → Orders
          </Link>
          .
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup();
        }}
        className="rounded-lg border border-border bg-card p-5 sm:p-6"
        aria-label="Track an order"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tr-order" className="label-caps mb-1.5 block">
              Order number <span className="normal-case tracking-normal text-muted-foreground">· optional</span>
            </Label>
            <Input
              id="tr-order"
              ref={drillRef}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="PN-2026-000123"
              className="h-10 font-mono"
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="tr-phone" className="label-caps mb-1.5 block">Mobile on the order</Label>
            <Input
              id="tr-phone"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(localPhoneFromInput(e.target.value))}
              placeholder="98765 43210"
              className="h-10"
              autoComplete="tel-national"
            />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="mt-5 h-11">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PackageSearch className="h-4 w-4" aria-hidden />}
          {orderNumber.trim() ? "Track order" : "Find my orders"}
        </Button>
      </form>

      {error && (
        <Alert variant="destructive" className="mt-6" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertTitle>Could not track that order</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* phone-only result: order index */}
      {list && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mt-8"
          aria-label="Orders on this mobile number"
          aria-live="polite"
        >
          <h2 className="label-caps mb-3">
            {list.length} order{list.length === 1 ? "" : "s"} on this mobile
          </h2>
          <ul className="space-y-3">
            {list.map((o, idx) => (
              <motion.li
                key={o.orderNumber}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05, ease: "easeOut" }}
              >
                <button
                  type="button"
                  onClick={() => drillInto(o.orderNumber)}
                  className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Open tracking for order ${o.orderNumber}`}
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium">{o.orderNumber}</span>
                      <StatusChip status={o.status} />
                      {o.returnStatus && <ReturnChip status={o.returnStatus} />}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Placed{" "}
                      {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(o.placedAt))} ·{" "}
                      {o.itemCount} item{o.itemCount === 1 ? "" : "s"} ·{" "}
                      {o.paymentMethod === "COD" ? "Cash on Delivery" : "Prepaid"}
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </button>
              </motion.li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* detail result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mt-8 space-y-6"
          aria-live="polite"
        >
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-xl">{result.orderNumber}</h2>
                <StatusChip status={result.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                Placed{" "}
                {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(result.placedAt))} ·{" "}
                {result.paymentMethod === "COD" ? "Cash on Delivery" : "Razorpay"} · updates to {result.contactPhone}
              </p>
            </div>
            {result.items.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {result.items.map((i, idx) => (
                  <li key={`${i.name}-${idx}`}>
                    {i.name} <span className="text-xs">({i.variant}) × {i.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
            {(result.return || result.paymentStatus === "REFUNDED" || result.status === "CANCELLED") && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
                {result.return && <ReturnChip status={result.return.status} />}
                {result.paymentStatus === "REFUNDED" && (
                  <span className="inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                    Payment refunded to source
                  </span>
                )}
                {result.status === "CANCELLED" && result.paymentStatus !== "REFUNDED" && (
                  <span className="inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                    Order cancelled — stock released
                  </span>
                )}
              </div>
            )}
          </div>

          <TrackingTimeline
            status={result.status}
            statusHistory={result.statusHistory}
            estimatedDeliveryAt={result.estimatedDeliveryAt}
            shipment={result.shipment}
          />

          {result.return && result.return.status === "REQUESTED" && (
            <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              Our team reviews return requests within one working day — you will get a WhatsApp update on{" "}
              {result.contactPhone}.
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
