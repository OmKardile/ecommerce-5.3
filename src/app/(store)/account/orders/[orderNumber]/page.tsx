import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, Landmark } from "lucide-react";
import { getCustomerSession, getAdminSession } from "@/lib/session";
import { getOrderByNumber } from "@/server/services/order.service";
import { formatINR } from "@/lib/money";
import { ORDER_STATUS_LABELS, STORE, type OrderStatus } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TrackingTimeline } from "@/components/storefront/tracking-timeline";
import { PayNowButton } from "@/components/storefront/checkout-pay-now-button";
import { CancelOrderButton, EditAddressButton, RequestReturnButton } from "@/components/storefront/order-actions";

/** Statuses the customer may self-cancel — mirrors order.service (pre-pack only). */
const CUSTOMER_CANCELLABLE: OrderStatus[] = ["PENDING_PAYMENT", "COD_PENDING", "PAID", "CONFIRMED", "PROCESSING"];
const RETURN_WINDOW_DAYS = 7;

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Order ${decodeURIComponent(orderNumber)}` };
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

function parseSerials(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default async function AccountOrderDetailPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const session = await getCustomerSession();
  if (!session) redirect(`/account/login?next=${encodeURIComponent(`/account/orders/${orderNumber}`)}`);

  const order = await getOrderByNumber(decodeURIComponent(orderNumber));
  if (!order) notFound();
  const admin = await getAdminSession();
  if (order.userId !== session.userId && !admin) notFound();

  const status = order.status as OrderStatus;
  const payment = order.payments[order.payments.length - 1];
  const paid = payment?.status === "SUCCESS" || ["PAID", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status);
  const shipment = order.shipments[0] ?? null;
  const awaitingPayment = status === "PENDING_PAYMENT" && order.paymentMethod === "RAZORPAY";

  // ---- customer self-service eligibility (mirrors order.service rules) ----
  const canCancel = CUSTOMER_CANCELLABLE.includes(status);
  const canEditAddress = CUSTOMER_CANCELLABLE.includes(status);
  const deliveredAtEntry = [...order.statusHistory].reverse().find((h) => h.status === "DELIVERED");
  const daysLeft = deliveredAtEntry
    ? Math.max(0, RETURN_WINDOW_DAYS - Math.floor((Date.now() - new Date(deliveredAtEntry.createdAt).getTime()) / 86_400_000))
    : null;
  const canReturn = status === "DELIVERED" && (daysLeft === null || daysLeft > 0);
  const openReturn = order.returns.find((r) => r.status === "REQUESTED" || r.status === "APPROVED") ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <Link href="/account/orders" className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All orders
      </Link>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps mb-2">Order detail</p>
          <h1 className="font-display text-3xl sm:text-4xl">{order.orderNumber}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>Placed {formatDate(order.createdAt)}</span>
            <Badge variant={status === "CANCELLED" ? "destructive" : "outline"} className={status === "DELIVERED" ? "border-primary/40 text-primary" : ""}>
              {ORDER_STATUS_LABELS[status] ?? status}
            </Badge>
            {order.isB2B && (
              <Badge variant="outline" className="text-[10px]">
                B2B {order.gstin ? `· ${order.gstin}` : ""}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="h-10">
            <Link href={`/account/orders/${order.orderNumber}/invoice`}>
              <FileText className="h-4 w-4" aria-hidden /> View invoice
            </Link>
          </Button>
          <RequestReturnButton orderNumber={order.orderNumber} canReturn={canReturn} hasOpenReturn={Boolean(openReturn)} daysLeft={daysLeft ?? undefined} />
          <CancelOrderButton orderNumber={order.orderNumber} canCancel={canCancel} />
        </div>
      </header>

      {openReturn && (
        <div className="mb-8 rounded-lg border border-border bg-card p-5" role="status">
          <p className="label-caps mb-1 text-primary">Return request {openReturn.status === "REQUESTED" ? "received" : "approved"}</p>
          <p className="text-sm text-muted-foreground">
            {openReturn.status === "REQUESTED"
              ? "Our trade desk reviews return requests within one working day. Approved DOA/warranty returns are picked up from the installation address — keep the unit boxed with its accessories."
              : "Approved. Keep the unit boxed with its accessories — pickup will be scheduled and you will be notified."}
          </p>
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">“{openReturn.reason}” — {formatDate(openReturn.createdAt)}</p>
        </div>
      )}

      {awaitingPayment && (
        <div className="mb-8 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">Payment pending — stock is reserved for you.</p>
              <p className="mt-1 text-xs text-muted-foreground">Complete the payment to confirm dispatch, or the reservation expires with the order.</p>
            </div>
            <PayNowButton orderId={order.id} orderNumber={order.orderNumber} amountPaise={order.totalAmount} label={`Pay ${formatINR(order.totalAmount)} now`} />
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <TrackingTimeline
            status={order.status}
            statusHistory={order.statusHistory.map((h) => ({ status: h.status, comment: h.comment, at: h.createdAt.toISOString() }))}
            estimatedDeliveryAt={order.estimatedDeliveryAt ? order.estimatedDeliveryAt.toISOString() : null}
            shipment={
              shipment
                ? {
                    courierName: shipment.courierName,
                    awb: shipment.awb,
                    trackingUrl: shipment.trackingUrl,
                    status: shipment.status,
                    events: shipment.events.map((e) => ({ status: e.status, location: e.location, occurredAt: e.occurredAt.toISOString() })),
                  }
                : null
            }
          />

          <section aria-label="Items" className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <h3 className="font-display text-lg">Items ({order.items.length})</h3>
            <ul className="mt-4 divide-y divide-border">
              {order.items.map((item) => {
                const serials = parseSerials(item.serialNumbers);
                return (
                  <li key={item.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{item.productName}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.variantName} · SKU <span className="font-mono">{item.skuCode}</span> · HSN {item.hsnCode}
                        </p>
                      </div>
                      <p className="whitespace-nowrap text-sm font-medium">
                        {item.quantity} × {formatINR(item.unitPrice)}
                      </p>
                    </div>
                    {serials.length > 0 && (
                      <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">Serial numbers (warranty-registered):</span>{" "}
                        <span className="font-mono">{serials.join(", ")}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="Delivery address" className="rounded-lg border border-border bg-card p-5 text-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg">Delivery address</h3>
              <EditAddressButton
                orderNumber={order.orderNumber}
                canEdit={canEditAddress}
                initial={{
                  recipientName: order.deliveryName,
                  phone: order.deliveryPhone,
                  addressLine1: order.deliveryLine1,
                  addressLine2: order.deliveryLine2 ?? "",
                  landmark: order.deliveryLandmark ?? "",
                  city: order.deliveryCity,
                  state: order.deliveryState,
                  pincode: order.deliveryPincode,
                }}
              />
            </div>
            <address className="mt-3 not-italic leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{order.deliveryName}</span>
              <br />
              {order.deliveryLine1}
              {order.deliveryLine2 ? <>, {order.deliveryLine2}</> : null}
              {order.deliveryLandmark ? <>, {order.deliveryLandmark}</> : null}
              <br />
              {order.deliveryCity}, {order.deliveryState} — {order.deliveryPincode}
              <br />
              +91 {order.deliveryPhone.replace(/\D/g, "").slice(-10)}
            </address>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <section aria-label="Payment" className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <h3 className="font-display text-lg">Payment</h3>
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium">{order.paymentMethod === "COD" ? "Cash on Delivery" : "Razorpay (online)"}</span>
              </div>
              {payment && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gateway status</span>
                    <Badge variant={payment.status === "SUCCESS" ? "default" : payment.status === "FAILED" ? "destructive" : "outline"}>
                      {payment.status.toLowerCase()}
                    </Badge>
                  </div>
                  {payment.gatewayPaymentId && (
                    <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                      <span>Payment id</span>
                      <span className="truncate font-mono">{payment.gatewayPaymentId}</span>
                    </div>
                  )}
                </>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatINR(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Coupon {order.couponCode}</span>
                  <span className="font-medium">− {formatINR(order.discountAmount)}</span>
                </div>
              )}
              {order.bundleDiscount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Kit bundle {order.bundleName ? `· ${order.bundleName}` : ""}</span>
                  <span className="font-medium">− {formatINR(order.bundleDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium">{order.shippingAmount === 0 ? "FREE" : formatINR(order.shippingAmount)}</span>
              </div>
              {order.codFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">COD fee</span>
                  <span className="font-medium">{formatINR(order.codFee)}</span>
                </div>
              )}
              {order.cgstAmount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>CGST (incl.)</span>
                  <span>{formatINR(order.cgstAmount)}</span>
                </div>
              )}
              {order.sgstAmount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>SGST (incl.)</span>
                  <span>{formatINR(order.sgstAmount)}</span>
                </div>
              )}
              {order.igstAmount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>IGST (incl.)</span>
                  <span>{formatINR(order.igstAmount)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex items-baseline justify-between">
                <span className="font-medium">Total</span>
                <span className="font-display text-2xl">{formatINR(order.totalAmount)}</span>
              </div>
            </div>
          </section>

          <div className="rounded-lg border border-border bg-muted/50 p-5 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Landmark className="h-3.5 w-3.5 text-primary" aria-hidden /> Issues with this order?
            </p>
            <p className="mt-1.5">
              Call {STORE.supportPhone} or WhatsApp with the order number and SKU. Returns are accepted on unused hardware within the documented window — serials must match dispatch records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
