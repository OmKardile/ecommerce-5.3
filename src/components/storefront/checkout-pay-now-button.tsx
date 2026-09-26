"use client";

// PayNowButton — drives the Razorpay flow for a PENDING_PAYMENT order.
// Dual-mode (ADR-007): mock keys open the sandbox dialog (simulate success/failure);
// live keys load checkout.js and open the real Razorpay modal, verifying server-side.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatINR } from "@/lib/money";
import { useCartStore } from "@/store/cart-store";
import { clearAppliedCoupon } from "@/components/storefront/cart-coupon-box";
import { toast } from "@/hooks/use-toast";

interface GatewayOrderResponse {
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
  publicKeyId: string;
  mock: boolean;
  orderNumber: string;
}

interface RazorpayHandlerResponse extends Response {
  json(): Promise<{ ok: boolean; error?: string; data?: { verified: boolean; orderNumber?: string } }>;
}

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      prefill?: { contact?: string };
      theme?: { color?: string };
      handler?: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
      modal?: { ondismiss?: () => void };
    }) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface PayNowButtonProps {
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  /** Navigate here after captured payment (default: /order-success/<orderNumber>). */
  redirectTo?: string;
  /** Fire the flow automatically once mounted (used right after checkout order creation). */
  autoOpen?: boolean;
  /** Optional callback instead of navigation (checkout passes one). */
  onSuccess?: () => void;
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}

export function PayNowButton({
  orderId,
  orderNumber,
  amountPaise,
  redirectTo,
  autoOpen = false,
  onSuccess,
  label = "Complete payment",
  variant = "default",
  className,
}: PayNowButtonProps) {
  const router = useRouter();
  const refreshCart = useCartStore((s) => s.refresh);

  const [open, setOpen] = useState(false);
  const [gateway, setGateway] = useState<GatewayOrderResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [simulating, setSimulating] = useState<"success" | "failure" | null>(null);
  const [failedOnce, setFailedOnce] = useState(false);
  const autoFired = useRef(false);

  const navigateAfterSuccess = useCallback(() => {
    clearAppliedCoupon();
    void refreshCart();
    if (onSuccess) {
      onSuccess();
    } else {
      router.push(redirectTo ?? `/order-success/${orderNumber}`);
      router.refresh();
    }
  }, [onSuccess, orderNumber, redirectTo, router, refreshCart]);

  const startGateway = useCallback(async (): Promise<GatewayOrderResponse | null> => {
    setStarting(true);
    try {
      const res = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; data?: GatewayOrderResponse };
      if (!json.ok || !json.data) {
        toast({ title: "Could not start payment", description: json.error ?? "Gateway unavailable, try again.", variant: "destructive" });
        return null;
      }
      setGateway(json.data);
      if (json.data.mock) {
        setOpen(true);
        return json.data;
      }
      // live gateway — load the SDK and open Razorpay Checkout
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        toast({ title: "Payment gateway failed to load", description: "Check your connection and retry.", variant: "destructive" });
        return null;
      }
      const rzp = new window.Razorpay({
        key: json.data.publicKeyId,
        amount: json.data.amountPaise,
        currency: json.data.currency,
        name: "Patel Networks",
        description: `Order ${json.data.orderNumber}`,
        order_id: json.data.gatewayOrderId,
        theme: { color: "#1a3c34" },
        handler: (response) => {
          void (async () => {
            try {
              const verifyRes: RazorpayHandlerResponse = await fetch("/api/payments/razorpay/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const verifyJson = await verifyRes.json();
              if (verifyJson.ok && verifyJson.data?.verified) {
                toast({ title: "Payment captured", description: "Your order is confirmed." });
                navigateAfterSuccess();
              } else {
                toast({ title: "Verification failed", description: verifyJson.error ?? "Contact support with your payment id.", variant: "destructive" });
              }
            } catch {
              toast({ title: "Verification error", description: "Network issue while confirming the payment.", variant: "destructive" });
            }
          })();
        },
        modal: {
          ondismiss: () => {
            toast({ title: "Payment cancelled", description: "The order stays pending — you can pay anytime from your orders page." });
          },
        },
      });
      rzp.open();
      return json.data;
    } catch {
      toast({ title: "Could not start payment", description: "Network error — please retry.", variant: "destructive" });
      return null;
    } finally {
      setStarting(false);
    }
  }, [navigateAfterSuccess, orderId]);

  async function simulate(outcome: "success" | "failure") {
    if (!gateway) return;
    setSimulating(outcome);
    try {
      const res = await fetch("/api/payments/razorpay/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, outcome }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; data?: { outcome: string; verified?: boolean } };
      if (!json.ok) {
        toast({ title: "Simulation failed", description: json.error ?? "Try again.", variant: "destructive" });
        return;
      }
      if (outcome === "success") {
        toast({ title: "Payment successful", description: `Order ${orderNumber} is confirmed. Redirecting…` });
        setOpen(false);
        navigateAfterSuccess();
      } else {
        setFailedOnce(true);
        toast({
          title: "Payment failed",
          description: "The order remains pending — retry below or pay later from your orders page.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Simulation error", description: "Network error — please retry.", variant: "destructive" });
    } finally {
      setSimulating(null);
    }
  }

  useEffect(() => {
    if (autoOpen && !autoFired.current && orderId) {
      autoFired.current = true;
      void Promise.resolve().then(() => void startGateway());
    }
  }, [autoOpen, orderId, startGateway]);

  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => void startGateway()} disabled={starting}>
        {starting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wallet className="h-4 w-4" aria-hidden />} {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby="rzp-sandbox-desc">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Razorpay Sandbox</DialogTitle>
            <DialogDescription id="rzp-sandbox-desc">
              Test-mode gateway. No real money moves — simulate an outcome to exercise the full capture pipeline.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex items-baseline justify-between">
              <span className="label-caps">Amount</span>
              <span className="font-display text-2xl">{formatINR(gateway?.amountPaise ?? amountPaise)}</span>
            </div>
            <Separator className="my-3" />
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Order</dt>
                <dd className="font-mono">{orderNumber}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Gateway order id</dt>
                <dd className="truncate font-mono">{gateway?.gatewayOrderId ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Method</dt>
                <dd>UPI · Cards · Netbanking</dd>
              </div>
            </dl>
          </div>

          {failedOnce && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Previous attempt failed. The order is still pending — you can retry or pay later from Account → Orders.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => void simulate("success")} disabled={simulating !== null} className="h-11">
              {simulating === "success" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
              Simulate successful payment
            </Button>
            <Button type="button" variant="outline" onClick={() => void simulate("failure")} disabled={simulating !== null} className="h-11">
              {simulating === "failure" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ExternalLink className="h-4 w-4" aria-hidden />}
              Simulate failed payment
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Pay later from Account → Orders
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
