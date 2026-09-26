import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature, ReceiptText, Truck, Banknote, Gavel, ShieldAlert } from "lucide-react";
import { PageShell, ContentSection, ContentContainer, CtaBand } from "@/components/content/page-shell";
import { STORE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Sale — Commercial Terms, GST Invoicing & Jurisdiction | Patel Networks",
  description:
    "Terms for buying from Patel Networks: 18% GST tax invoicing, title transfer on carrier handoff at Surat, COD conditions, warranty disclaimer and Surat, Gujarat jurisdiction.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Terms of sale"
      title="The terms behind the tax invoice"
      lede="These terms govern every sale made on this store by Patel Networks (MegaTech), Surat. They are written for a commercial trade — plain, and matched to how the warehouse actually runs."
      aside="Last reviewed: Feb 2026"
    >
      <ContentContainer>
        <ContentSection eyebrow="The agreement" title="Who sells, who buys" first>
          <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              <FileSignature className="mb-0.5 mr-1 inline h-4 w-4 text-primary" aria-hidden />
              The seller is <strong className="font-semibold">Patel Networks (MegaTech)</strong>, Surat, Gujarat —
              GSTIN {STORE.gstin}, state code {STORE.originStateCode}. The buyer is the account holder placing the
              order: a retail consumer, or a business purchasing for trade use. Placing an order on the store
              constitutes acceptance of these terms, the{" "}
              <Link href="/shipping-policy" className="underline underline-offset-2 hover:text-foreground">
                shipping policy
              </Link>
              , the{" "}
              <Link href="/return-policy" className="underline underline-offset-2 hover:text-foreground">
                return &amp; warranty policy
              </Link>{" "}
              and the{" "}
              <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-foreground">
                privacy policy
              </Link>
              .
            </p>
            <p>
              Buyers represent that details supplied at checkout — name, phone, delivery address, and for B2B
              purchases the legal business name and GSTIN — are true and belong to them. Orders placed with false
              GSTINs may be cancelled and re-invoiced correctly.
            </p>
          </div>
        </ContentSection>

        <ContentSection eyebrow="Pricing & tax" title="GST-inclusive pricing, proper invoicing">
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground/90">
            <li>
              <ReceiptText className="mb-0.5 mr-1 inline h-4 w-4 text-primary" aria-hidden />
              Listed prices are inclusive of <strong className="font-semibold">18% GST</strong> unless a page states
              otherwise. The invoice splits tax by destination: CGST + SGST for Gujarat deliveries, IGST for other
              states, with HSN codes per line.
            </li>
            <li>
              B2B buyers who enter a GSTIN receive a tax invoice naming their business; the invoice is the document
              of record for input tax credit. Re-billing of a personal-name order to a business later is not
              possible.
            </li>
            <li>
              A confirmed order reserves the listed price. If a listing error is discovered before dispatch, we
              contact you to confirm or cancel with a full refund.
            </li>
            <li>
              Coupons and bundle discounts apply as displayed at checkout; the order total on the payment screen is
              the final payable amount.
            </li>
          </ul>
        </ContentSection>

        <ContentSection eyebrow="Title & risk" title="Ownership passes at the Surat dock">
          <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              <Truck className="mb-0.5 mr-1 inline h-4 w-4 text-primary" aria-hidden />
              <strong className="font-semibold">Title to, and risk in, the goods pass to the buyer when the packed
              consignment is handed to the carrier at our Surat warehouse.</strong> From that handover, transit is
              the carrier&apos;s custody under the shipping policy; loss or damage in transit is handled through the
              carrier process and the 7-day DOA window, not by re-opening the sale. Until handover, goods remain our
              stock and are insured as such.
            </p>
          </div>
        </ContentSection>

        <ContentSection eyebrow="Payment" title="Prepaid and COD conditions">
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground/90">
            <li>
              <Banknote className="mb-0.5 mr-1 inline h-4 w-4 text-primary" aria-hidden />
              Online payments are collected via Razorpay (UPI, cards, netbanking). An order is eligible for dispatch
              once payment is captured; failed or reversed payments release the reserved stock.
            </li>
            <li>
              <strong className="font-semibold">Cash on delivery</strong> is a selective facility: enabled per
              product, capped at ₹15,000 per order, unavailable in special/remote zones, with a ₹49 COD handling fee.
              Refusal at the door repeatedly may lead to COD being disabled for the account.
            </li>
            <li>
              <strong className="font-semibold">Bank transfer:</strong> NEFT/RTGS details are shared on request for
              orders above online limits; dispatch follows realisation of funds against the proforma invoice.
            </li>
          </ul>
        </ContentSection>

        <ContentSection eyebrow="Warranty" title="The manufacturer warrants the hardware">
          <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              <ShieldAlert className="mb-0.5 mr-1 inline h-4 w-4 text-primary" aria-hidden />
              Patel Networks supplies hardware under the respective manufacturer&apos;s warranty (typically 2 years
              for CP Plus, Hikvision and Dahua cameras and recorders; 3 years for WD Purple drives — the binding
              period is printed on each product page and invoice). Beyond the 7-day DOA replacement window described
              in the return policy, remedies for defects are those the manufacturer provides through its service
              network. To the maximum extent permitted by law, our liability for any order is limited to the invoice
              value of the goods supplied under it, and we are not liable for consequential losses — including loss
              of recorded footage, site downtime or third-party claims — arising from product use.
            </p>
          </div>
        </ContentSection>

        <ContentSection eyebrow="Order changes" title="Cancellation and amendments">
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-foreground/90">
            <li>Orders may be cancelled while they are still unpaid or before dispatch; prepaid amounts are refunded to the original payment method.</li>
            <li>After carrier handover, a shipment cannot be intercepted; undelivered parcels return to Surat and are refunded per the return policy.</li>
            <li>We may cancel an order where stock proves unserviceable after reservation, or where the order breaches these terms; the buyer is informed and any payment is refunded in full.</li>
          </ul>
        </ContentSection>

        <ContentSection eyebrow="Governing law" title="Jurisdiction: Surat, Gujarat">
          <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              <Gavel className="mb-0.5 mr-1 inline h-4 w-4 text-primary" aria-hidden />
              These terms are governed by the laws of India. Sales made from this store are deemed to be concluded at
              Surat, Gujarat, and the courts at <strong className="font-semibold">Surat, Gujarat</strong> have
              exclusive jurisdiction over any dispute arising from them, without prejudice to seeking interim relief
              elsewhere where necessary. Disputes are first attempted in good faith through the trade desk and the
              grievance contact named in the privacy policy.
            </p>
          </div>
        </ContentSection>

        <div className="border-t border-border pt-10 pb-4 lg:pb-8">
          <CtaBand
            title="Buying for a business? Get the paperwork right first."
            body="The trade desk can confirm GST treatment, freight and settlement terms for your institutional order before you commit."
            href="/contact"
            ctaLabel="Talk to the trade desk"
            secondaryHref="/faq"
            secondaryLabel="Common questions"
          />
        </div>
      </ContentContainer>
    </PageShell>
  );
}
