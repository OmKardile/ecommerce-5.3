import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCustomerSession, getAdminSession } from "@/lib/session";
import { getOrderByNumber } from "@/server/services/order.service";
import { formatINR } from "@/lib/money";
import { splitGstInclusive } from "@/lib/gst";
import { STORE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { InvoicePrintButton } from "@/components/storefront/invoice";

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Tax invoice ${decodeURIComponent(orderNumber)}` };
}

export default async function InvoicePage({ params }: PageProps) {
  const { orderNumber } = await params;
  const session = await getCustomerSession();
  if (!session) redirect(`/account/login?next=${encodeURIComponent(`/account/orders/${orderNumber}/invoice`)}`);

  const order = await getOrderByNumber(decodeURIComponent(orderNumber));
  if (!order) notFound();
  const admin = await getAdminSession();
  if (order.userId !== session.userId && !admin) notFound();

  // intra-state (CGST+SGST) when the destination is the origin state — mirrors the order engine
  const intra = order.deliveryState === STORE.originState;

  const lines = order.items.map((item) => {
    const split = splitGstInclusive(item.unitPrice, item.taxRate, intra ? STORE.originState : "Other");
    return {
      ...item,
      unitBase: split.base,
      unitGst: split.gst,
      lineBase: split.base * item.quantity,
      lineGst: split.gst * item.quantity,
    };
  });

  const taxableTotal = lines.reduce((n, l) => n + l.lineBase, 0);
  const grandTotal = order.totalAmount;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/account/orders/${order.orderNumber}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to order
        </Link>
        <InvoicePrintButton />
      </div>

      <article className="print-sheet rounded-lg border border-border bg-white p-6 text-foreground sm:p-10" aria-label={`Tax invoice ${order.orderNumber}`}>
        {/* header */}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-foreground/80 pb-6">
          <div>
            <p className="font-display text-2xl font-semibold tracking-tight">{STORE.legalName}</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/70">
              Wholesale & distribution — CCTV, surveillance and structured networking hardware
              <br />
              Surat, Gujarat — {STORE.originPin} · {STORE.supportPhone} · {STORE.email}
            </p>
            <p className="mt-1.5 text-xs">
              <span className="font-semibold">GSTIN:</span> <span className="font-mono">{STORE.gstin}</span>{" "}
              <span className="ml-3 font-semibold">State code:</span> {STORE.originStateCode}
            </p>
          </div>
          <div className="text-right">
            <p className="label-caps !text-foreground/60">Tax invoice</p>
            <p className="font-display text-xl font-semibold">{order.orderNumber}</p>
            <p className="mt-1 text-xs text-foreground/70">
              Dated{" "}
              {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(order.createdAt)}
            </p>
            <p className="text-xs text-foreground/70">
              Payment: {order.paymentMethod === "COD" ? "Cash on Delivery" : "Razorpay (online)"}
            </p>
          </div>
        </header>

        {/* buyer + shipping */}
        <div className="grid gap-6 border-b border-foreground/15 py-5 sm:grid-cols-2">
          <div>
            <p className="label-caps !text-foreground/60 mb-1.5">Billed to</p>
            <p className="text-sm font-semibold">{order.isB2B && order.companyName ? order.companyName : order.deliveryName}</p>
            {order.isB2B && order.companyName && <p className="text-xs text-foreground/70">Attn: {order.deliveryName}</p>}
            {order.isB2B && order.gstin && (
              <p className="mt-0.5 text-xs">
                <span className="font-semibold">Buyer GSTIN:</span> <span className="font-mono">{order.gstin}</span>
              </p>
            )}
            <p className="mt-0.5 text-xs text-foreground/70">+91 {order.deliveryPhone.replace(/\D/g, "").slice(-10)}</p>
          </div>
          <div>
            <p className="label-caps !text-foreground/60 mb-1.5">Shipping address</p>
            <address className="text-xs not-italic leading-relaxed text-foreground/80">
              {order.deliveryName}
              <br />
              {order.deliveryLine1}
              {order.deliveryLine2 ? <>, {order.deliveryLine2}</> : null}
              {order.deliveryLandmark ? <>, {order.deliveryLandmark}</> : null}
              <br />
              {order.deliveryCity}, {order.deliveryState} — {order.deliveryPincode}
            </address>
            <p className="mt-1.5 text-xs text-foreground/70">
              Place of supply: {order.deliveryState} ({intra ? "intra-state — CGST+SGST" : "inter-state — IGST"})
            </p>
          </div>
        </div>

        {/* line items */}
        <table className="mt-6 w-full border-collapse text-xs">
          <caption className="sr-only">Invoice line items with HSN codes and GST breakdown</caption>
          <thead>
            <tr className="border-b border-foreground/30 text-left">
              <th scope="col" className="py-2 pr-2 font-semibold">#</th>
              <th scope="col" className="py-2 pr-2 font-semibold">Item</th>
              <th scope="col" className="py-2 pr-2 font-semibold">HSN</th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">Qty</th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">Rate (incl.)</th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">Taxable</th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">GST {intra ? "9%" : "18%"}</th>
              <th scope="col" className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => (
              <tr key={l.id} className="border-b border-foreground/10 align-top">
                <td className="py-2.5 pr-2 text-foreground/70">{idx + 1}</td>
                <td className="py-2.5 pr-2">
                  <span className="font-medium">{l.productName}</span>
                  <span className="block text-[11px] text-foreground/60">
                    {l.variantName} · SKU {l.skuCode}
                  </span>
                </td>
                <td className="py-2.5 pr-2 text-foreground/70">{l.hsnCode}</td>
                <td className="py-2.5 pr-2 text-right tabular-nums">{l.quantity}</td>
                <td className="py-2.5 pr-2 text-right tabular-nums">{formatINR(l.unitPrice, { withDecimals: true })}</td>
                <td className="py-2.5 pr-2 text-right tabular-nums">{formatINR(l.lineBase, { withDecimals: true })}</td>
                <td className="py-2.5 pr-2 text-right tabular-nums">
                  {formatINR(l.lineGst, { withDecimals: true })}
                  <span className="block text-[10px] text-foreground/50">@{l.taxRate}%</span>
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums">{formatINR(l.totalPrice, { withDecimals: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-foreground/70">Taxable value</dt>
              <dd className="tabular-nums">{formatINR(taxableTotal, { withDecimals: true })}</dd>
            </div>
            {intra ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-foreground/70">CGST</dt>
                  <dd className="tabular-nums">{formatINR(order.cgstAmount, { withDecimals: true })}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-foreground/70">SGST</dt>
                  <dd className="tabular-nums">{formatINR(order.sgstAmount, { withDecimals: true })}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <dt className="text-foreground/70">IGST</dt>
                <dd className="tabular-nums">{formatINR(order.igstAmount, { withDecimals: true })}</dd>
              </div>
            )}
            {order.discountAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-foreground/70">Discount {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                <dd className="tabular-nums">− {formatINR(order.discountAmount, { withDecimals: true })}</dd>
              </div>
            )}
            {order.bundleDiscount > 0 && (
              <div className="flex justify-between">
                <dt className="text-foreground/70">Kit bundle discount {order.bundleName ? `(${order.bundleName})` : ""}</dt>
                <dd className="tabular-nums">− {formatINR(order.bundleDiscount, { withDecimals: true })}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-foreground/70">Shipping{order.codFee > 0 ? " + COD fee" : ""}</dt>
              <dd className="tabular-nums">{formatINR(order.shippingAmount + order.codFee, { withDecimals: true })}</dd>
            </div>
            <div className="flex justify-between border-t border-foreground/30 pt-2 text-sm font-semibold">
              <dt>Grand total</dt>
              <dd className="font-display tabular-nums">{formatINR(grandTotal, { withDecimals: true })}</dd>
            </div>
          </dl>
        </div>

        {/* declaration */}
        <footer className="mt-8 border-t border-foreground/15 pt-4 text-[11px] leading-relaxed text-foreground/60">
          <p>
            Declaration: This is a computer-generated tax invoice issued under the CGST Act, 2017. All amounts are GST-inclusive; the
            taxable value and tax components above are derived from the inclusive price. Goods once dispatched are covered by the
            manufacturer warranty registered against the serial numbers recorded at packing. Subject to Surat jurisdiction.
          </p>
          <p className="mt-2">
            {STORE.legalName} · GSTIN {STORE.gstin} · {STORE.email}
          </p>
        </footer>
      </article>

      <p className="no-print mt-4 text-center text-[11px] text-muted-foreground">
        Use your browser&apos;s print dialog to save this invoice as PDF. Serial numbers, where captured, appear on the order page.
      </p>
    </div>
  );
}
