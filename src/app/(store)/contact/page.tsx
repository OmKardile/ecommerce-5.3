import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, MessageCircle, Landmark, ReceiptText, Clock } from "lucide-react";
import { PageShell, ContentContainer } from "@/components/content/page-shell";
import { B2BInquiryForm } from "@/components/content/b2b-inquiry-form";
import { STORE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact the Trade Desk — B2B & Wholesale Surveillance Hardware",
  description:
    "Commercial consultation desk for installers, contractors and institutional buyers: GST quotations, bulk pricing, bank-transfer settlement. Surat hub, Gujarat. Response within one working day.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>;
}) {
  const params = await searchParams;
  const productParam = typeof params.product === "string" ? params.product : undefined;
  const prefillProductRef = productParam ? `Product reference: ${productParam}` : undefined;

  const whatsappLink = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(
    "Hello Patel Networks — I would like a quotation for surveillance hardware."
  )}`;

  return (
    <PageShell
      eyebrow="Commercial consultation desk"
      title="Quotes for sites, installers and institutions"
      lede="Tell the trade desk what the site needs and receive a bill of materials with GST pricing. Retail order questions are answered fastest by phone or WhatsApp."
    >
      <ContentContainer>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Form */}
          <div className="lg:col-span-7">
            <B2BInquiryForm prefillProductRef={prefillProductRef} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:col-span-5" aria-label="Direct contact channels">
            <div className="rounded-lg border border-border bg-card p-6">
              <MapPin className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="mt-4 font-display text-lg tracking-tight">Surat hub</h2>
              <address className="mt-2 text-[13px] not-italic leading-relaxed text-muted-foreground">
                Patel Networks (MegaTechzy)
                <br />
                Surat Central Hub
                <br />
                Surat, Gujarat {STORE.originPin}
                <br />
                State code {STORE.originStateCode} · GSTIN {STORE.gstin}
              </address>
              <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Counter and phone lines open on working days. Orders paid before {STORE.dispatchCutoff} dispatch
                same-day.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <Phone className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="mt-4 font-display text-lg tracking-tight">Call the desk</h2>
              <a
                href={`tel:${STORE.supportPhone.replace(/\s/g, "")}`}
                className="link-underline mt-2 inline-block font-display text-xl tracking-tight"
              >
                {STORE.supportPhone}
              </a>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Specification questions, stock checks and courier updates are answered fastest on the phone.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <MessageCircle className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="mt-4 font-display text-lg tracking-tight">WhatsApp</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Send site photos, drawings or a BOQ. Order updates (dispatch, out-for-delivery) also arrive on
                WhatsApp once an order is placed.
              </p>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Message on WhatsApp
              </a>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <Landmark className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="mt-4 font-display text-lg tracking-tight">Institutional orders</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Bank transfer details are shared on request for orders above online limits (NEFT / RTGS against a GST
                tax invoice). Purchase-order backed supply is available for government, institutional and AMC
                customers.
              </p>
              <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
                <ReceiptText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Every invoice is GST-compliant — CGST/SGST for Gujarat, IGST for inter-state — with HSN codes per
                line for input tax credit.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-6">
              <h2 className="font-display text-lg tracking-tight">What happens after you send the form</h2>
              <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">1.</span> The trade desk reviews the requirement and
                  calls if anything is unclear.
                </li>
                <li>
                  <span className="font-medium text-foreground">2.</span> You receive a quotation with stock position
                  and delivery estimate.
                </li>
                <li>
                  <span className="font-medium text-foreground">3.</span> On confirmation, the order is reserved,
                  invoiced and dispatched from Surat.
                </li>
              </ol>
              <p className="mt-4 text-[12px] text-muted-foreground">
                Looking for order support instead? See{" "}
                <Link href="/track" className="underline underline-offset-2 hover:text-foreground">
                  track order
                </Link>{" "}
                and the{" "}
                <Link href="/return-policy" className="underline underline-offset-2 hover:text-foreground">
                  warranty policy
                </Link>
                .
              </p>
            </div>
          </aside>
        </div>
      </ContentContainer>
    </PageShell>
  );
}
