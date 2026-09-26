"use client";

// Order tracking timeline — five editorial stages driven by status history
// and shipment events. Presentational; used in order success, account detail and /track.

import { useState } from "react";
import { Check, Copy, PackageCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";

export interface TimelineStatusEvent {
  status: string;
  comment?: string | null;
  at: string;
}

export interface TimelineShipment {
  courierName?: string | null;
  awb?: string | null;
  trackingUrl?: string | null;
  status?: string | null;
  events: { status: string; location?: string | null; occurredAt: string }[];
}

const STAGES: { label: string; blurb: string }[] = [
  { label: "Confirmed", blurb: "Order received & verified" },
  { label: "Packed", blurb: "Quality-checked & boxed" },
  { label: "Shipped", blurb: "Handed to courier" },
  { label: "Out for Delivery", blurb: "On the last-mile vehicle" },
  { label: "Delivered", blurb: "Invoice & warranty active" },
];

const STAGE_OF_STATUS: Record<string, number> = {
  PENDING_PAYMENT: 0,
  COD_PENDING: 0,
  PAID: 0,
  CONFIRMED: 0,
  PROCESSING: 0,
  PACKED: 1,
  SHIPPED: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
};

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function stageTimestamps(history: TimelineStatusEvent[]): (string | null)[] {
  const firstAt = (statuses: string[]): string | null => {
    for (const s of statuses) {
      const hit = history.find((h) => h.status === s);
      if (hit) return hit.at;
    }
    return null;
  };
  return [
    firstAt(["CONFIRMED", "PAID", "COD_PENDING", "PROCESSING", "PENDING_PAYMENT"]),
    firstAt(["PACKED"]),
    firstAt(["SHIPPED"]),
    firstAt(["OUT_FOR_DELIVERY"]),
    firstAt(["DELIVERED"]),
  ];
}

export function TrackingTimeline({
  status,
  statusHistory,
  estimatedDeliveryAt,
  shipment,
}: {
  status: string;
  statusHistory: TimelineStatusEvent[];
  estimatedDeliveryAt?: string | null;
  shipment?: TimelineShipment | null;
}) {
  const [copied, setCopied] = useState(false);
  const isCancelled = status === "CANCELLED";
  const isReturnFlow = ["RETURN_REQUESTED", "RETURNED", "REFUNDED"].includes(status);
  const awaitingPayment = status === "PENDING_PAYMENT" || status === "COD_PENDING";
  const current = STAGE_OF_STATUS[status] ?? 0;
  const timestamps = stageTimestamps(statusHistory);
  const stageConfirmed = ["PAID", "CONFIRMED", "PROCESSING"].includes(status);

  async function copyAwb(awb: string) {
    try {
      await navigator.clipboard.writeText(awb);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — ignore silently
    }
  }

  return (
    <section aria-label="Delivery progress" className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg">Delivery progress</h3>
        {estimatedDeliveryAt && !isCancelled && (
          <p className="text-xs text-muted-foreground">
            Estimated delivery{" "}
            <span className="font-medium text-foreground">
              {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(estimatedDeliveryAt))}
            </span>
          </p>
        )}
      </div>

      {isCancelled && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          This order was cancelled. Reserved stock has been released and any captured payment is refunded to source.
        </div>
      )}
      {isReturnFlow && (
        <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Return status:{" "}
          <span className="font-medium text-foreground">{ORDER_STATUS_LABELS[status as OrderStatus] ?? status}</span>
        </div>
      )}

      {!isCancelled && (
        <ol className="relative" role="list">
          {STAGES.map((stage, i) => {
            const completed = i < current || (i === current && (i >= 1 || stageConfirmed)) || (i === 4 && status === "DELIVERED");
            const active = i === current && !completed;
            const ts = timestamps[i];
            return (
              <li key={stage.label} className="relative flex gap-4 pb-6 last:pb-0">
                {i < STAGES.length - 1 && (
                  <span
                    aria-hidden
                    className={cn("absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-px", i < current ? "bg-primary" : "bg-border")}
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                    completed ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary bg-background text-primary" : "border-border bg-background text-muted-foreground"
                  )}
                >
                  {completed ? <Check className="h-3.5 w-3.5" /> : <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-primary" : "bg-border")} />}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className={cn("text-sm font-medium", !completed && !active && "text-muted-foreground")}>{stage.label}</p>
                    {ts && <time className="text-xs text-muted-foreground">{formatDateTime(ts)}</time>}
                  </div>
                  <p className="text-xs text-muted-foreground">{stage.blurb}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {awaitingPayment && (
        <p className="mt-2 text-sm text-muted-foreground">
          {status === "PENDING_PAYMENT"
            ? "Awaiting payment confirmation — the order is confirmed automatically once the payment is captured."
            : "Cash on Delivery order placed — our team verifies the order before dispatch."}
        </p>
      )}

      {shipment && shipment.awb && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">{shipment.courierName ?? "Courier partner"}</p>
                <p className="text-xs text-muted-foreground">
                  AWB <span className="font-mono text-foreground">{shipment.awb}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void copyAwb(shipment.awb!)}>
                <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? "Copied" : "Copy AWB"}
              </Button>
              {shipment.trackingUrl && (
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Track on courier site
                </a>
              )}
            </div>
          </div>
          {shipment.events.length > 0 && (
            <div className="thin-scrollbar mt-4 max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/40">
              <ul className="divide-y divide-border/70">
                {[...shipment.events].reverse().map((ev, i) => (
                  <li key={`${ev.status}-${ev.occurredAt}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{ev.status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                      {ev.location && <p className="text-xs text-muted-foreground">{ev.location}</p>}
                    </div>
                    <time className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(ev.occurredAt)}</time>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {shipment.status === "DELIVERED" && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <PackageCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> Shipment delivered. Serial-tracked warranty is now active.
            </p>
          )}
        </div>
      )}

      {!isCancelled && status === "DELIVERED" && (
        <Badge variant="outline" className="mt-4 border-primary/40 text-primary">
          Delivered — thank you for building with Patel Networks
        </Badge>
      )}
    </section>
  );
}
