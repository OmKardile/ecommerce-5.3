import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, FileText, Package } from "lucide-react";
import { getOrderByNumber } from "@/server/services/order.service";
import { getCustomerSession, getAdminSession } from "@/lib/session";
import { formatINR } from "@/lib/money";
import { ORDER_STATUS_LABELS, STORE, type OrderStatus } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TrackingTimeline } from "@/components/storefront/tracking-timeline";
import { PayNowButton } from "@/components/storefront/checkout-pay-now-button";
import { CancelOrderButton, EditAddressButton } from "@/components/storefront/order-actions";

/** Statuses the customer may self-cancel — mirrors order.service (pre-pack only). */
const CUSTOMER_CANCELLABLE: OrderStatus[] = ["PENDING_PAYMENT", "COD_PENDING", "PAID", "CONFIRMED", "PROCESSING"];

interface OrderSuccessProps {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: OrderSuccessProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Order ${orderNumber} confirmed` };
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "full" }).format(new Date(date));
}

export default async function OrderSuccessPage({ params }: OrderSuccessProps) {
  const { orderNumber } = await params;
  const order = await getOrderByNumber(decodeURIComponent(orderNumber));
  if (!order) notFound();

  const [session, admin] = await Promise.all([getCustomerSession(), getAdminSession()]);
  const isOwner = session && order.userId === session.userId;
  if (!isOwner && !admin) notFound();

  const status = order.status as OrderStatus;
  const payment = order.payments[order.payments.length - 1];
  const paymentPaid = payment?.status === "SUCCESS" || (status !== "PENDING_PAYMENT" && status !== "COD_PENDING" && status !== "CANCELLED");
  const shipment = order.shipments[0] ?? null;
  const awaitingPayment = status === "PENDING_PAYMENT" && order.paymentMethod === "RAZORPAY";
  const codPending = status === "COD_PENDING";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      {/* hero */}
      <header className="text-center sm:text-left">
        <div className="mb-4 flex justify-center sm:justify-start">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {status === "CANCELLED" ? <Package className="h-7 w-7" aria-hidden /> : <CheckCircle2 className="h-7 w-7" aria-hidden />}
          </span>
        </div>
        <p className="label-caps mb-2">
          {status === "CANCELLED" ? "Order cancelled" : awaitingPayment ? "Order reserved — payment pending" : "Order confirmed"}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl">
          {status === "CANCELLED"
            ? "This order was cancelled."
            : awaitingPayment
              ? "Almost there — complete your payment."
              : codPending
                ? "COD order received."
                : "Thank you — your order is in."}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span>
            Order <span className="font-display text-base font-semibold text-foreground">{order.orderNumber}</span>
          </span>
          <span>
            Estimated delivery <span className="font-medium text-foreground">{formatDate(order.estimatedDeliveryAt)}</span>
          </span>
          <span>
            {order.paymentMethod === "COD" ? "Cash on Delivery" : "Razorpay"} ·{" "}
            <Badge variant={paymentPaid ? "default" : status === "CANCELLED" ? "destructive" : "outline"} className="align-middle">
              {paymentPaid ? "Paid" : ORDER_STATUS_LABELS[status] ?? status}
            </Badge>
          </span>
        </div>
      </header>

      {awaitingPayment && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">Complete the payment to confirm dispatch.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sandbox hint — the payment gateway runs in simulation mode here. You can also pay later from Account → Orders.
              </p>
            </div>
            <PayNowButton
              orderId={order.id}
              orderNumber={order.orderNumber}
              amountPaise={order.totalAmount}
              label={`Pay ${formatINR(order.totalAmount)} now`}
            />
          </div>
        </div>
      )}

      {CUSTOMER_CANCELLABLE.includes(status) && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground">Change of mind? You can cancel online while the order is still at the hub — stock is released instantly.</p>
          <CancelOrderButton orderNumber={order.orderNumber} canCancel />
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* left: timeline + items */}
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

          <section aria-label="Items in this order" className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <h3 className="font-display text-lg">Items ({order.items.length})</h3>
            <ul className="mt-4 divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{item.productName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.variantName} · SKU <span className="font-mono">{item.skuCode}</span> · Qty {item.quantity}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-sm font-medium">{formatINR(item.totalPrice)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* right: totals + actions */}
        <div className="space-y-6 lg:col-span-5">
          <section aria-label="Payment summary" className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <h3 className="font-display text-lg">Payment summary</h3>
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatINR(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Coupon {order.couponCode ?? ""}</span>
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
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>CGST (incl.)</span>
                    <span>{formatINR(order.cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>SGST (incl.)</span>
                    <span>{formatINR(order.sgstAmount)}</span>
                  </div>
                </>
              )}
              {order.igstAmount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>IGST (incl.)</span>
                  <span>{formatINR(order.igstAmount)}</span>
                </div>
              )}
              <Separator className="my-3" />
              <div className="flex items-baseline justify-between">
                <span className="font-medium">Total {paymentPaid ? "paid" : "payable"}</span>
                <span className="font-display text-2xl">{formatINR(order.totalAmount)}</span>
              </div>
            </div>
          </section>

          <section aria-label="Delivery address" className="rounded-lg border border-border bg-card p-5 sm:p-6 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg">Delivering to</h3>
              {isOwner && (
                <EditAddressButton
                  orderNumber={order.orderNumber}
                  canEdit={CUSTOMER_CANCELLABLE.includes(status)}
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
              )}
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

          <div className="flex flex-col gap-3">
            <Button asChild className="h-11">
              <Link href={`/account/orders/${order.orderNumber}/invoice`}>
                <FileText className="h-4 w-4" aria-hidden /> View GST invoice
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/products">
                Continue shopping <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Link href={`/account/orders/${order.orderNumber}`} className="link-underline text-center text-xs text-muted-foreground">
              Track this order from your account
            </Link>
          </div>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Questions? Call {STORE.supportPhone} or WhatsApp us — quote order {order.orderNumber}.
          </p>
        </div>
      </div>
    </div>
  );
}
