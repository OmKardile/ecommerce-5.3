import type { Metadata } from "next";
import Link from "next/link";
import { Database, CreditCard, MessageCircle, Timer, Scale, Phone } from "lucide-react";
import { PageShell, ContentSection, ContentContainer, CtaBand } from "@/components/content/page-shell";
import { STORE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy — Data We Collect & How It Is Handled | Patel Networks",
  description:
    "What Patel Networks collects (phone, addresses, GSTIN), how payments are processed by Razorpay without storing card data, WhatsApp notification consent, retention and grievance contact.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <PageShell
      eyebrow="Privacy policy"
      title="Commercial data, handled like stock"
      lede="We collect the minimum a hardware trade requires — a phone number to reach you, an address to deliver to, a GSTIN when you ask for input tax credit — and we keep it as carefully as we keep inventory."
      aside="Last reviewed: Feb 2026"
    >
      <ContentContainer>
        <ContentSection eyebrow="Legal footing" title="IT Act, 2000 and SPDI Rules" first>
          <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              This policy is framed under the Information Technology Act, 2000 and the (Reasonable Security Practices
              and Procedures and Sensitive Personal Data or Information) Rules, 2011. Patel Networks (MegaTech),
              Surat, Gujarat is the data fiduciary for information collected on this store. By using the store you
              agree to the practices described here and to the{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
                terms of sale
              </Link>
              .
            </p>
          </div>
        </ContentSection>

        <ContentSection eyebrow="What we collect" title="The minimum the trade requires">
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground/90">
            <li>
              <strong className="font-semibold">Identity &amp; contact:</strong> mobile number (the sign-in identity
              for OTP login), optional full name and email.
            </li>
            <li>
              <strong className="font-semibold">Delivery:</strong> shipping addresses you save or enter at checkout —
              recipient, lines, landmark, city, state, pincode.
            </li>
            <li>
              <strong className="font-semibold">Business tax details:</strong> legal business name and GSTIN when you
              opt for B2B input tax credit; these are printed on the tax invoice.
            </li>
            <li>
              <strong className="font-semibold">Order records:</strong> items, quantities, amounts, GST split,
              payment method, shipment and tracking events, serial numbers of dispatched units.
            </li>
            <li>
              <strong className="font-semibold">Inquiries:</strong> the details you submit to the trade desk
              (name, phone, company, GSTIN, requirement) — used only to answer the inquiry.
            </li>
            <li>
              <strong className="font-semibold">Technical logs:</strong> standard server logs and audit records
              required to operate and secure the store.
            </li>
          </ul>
        </ContentSection>

        <ContentSection eyebrow="Payments" title="Card data never touches our servers">
          <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              <CreditCard className="mb-0.5 mr-1 inline h-4 w-4 text-primary" aria-hidden />
              Online payments are processed by <strong className="font-semibold">Razorpay</strong> (UPI, cards,
              netbanking). Payment instruments are entered on Razorpay&apos;s PCI-DSS compliant infrastructure —
              Patel Networks does not collect or store card numbers, CVVs or UPI credentials. We receive and store
              only the payment confirmation identifiers needed to reconcile your order.
            </p>
            <p>
              For institutional orders settled by NEFT/RTGS, the bank transfer details are shared on request for
              orders above online limits; we store the invoice reference, not your banking credentials.
            </p>
          </div>
        </ContentSection>

        <ContentSection eyebrow="Notifications" title="WhatsApp and SMS consent">
          <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              <MessageCircle className="mb-0.5 mr-1 inline h-4 w-4 text-primary" aria-hidden />
              Order-critical updates — confirmation, dispatch with tracking, out-for-delivery — are sent to the
              mobile number on the order by WhatsApp or SMS. By placing an order you consent to these transactional
              messages on that number. Marketing is opt-in and separate: we do not add buyers to promotional lists
              without their explicit consent.
            </p>
          </div>
        </ContentSection>

        <ContentSection eyebrow="Sharing" title="Who else touches your data">
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-foreground/90">
            <li>
              <strong className="font-semibold">Carrier partners</strong> (Delhivery, Shiprocket network, BlueDart):
              recipient name, phone, address and item description — the minimum needed to deliver and collect on
              returns.
            </li>
            <li>
              <strong className="font-semibold">Payment gateway</strong> (Razorpay): order amount and identifiers, to
              collect and reconcile payment.
            </li>
            <li>
              <strong className="font-semibold">Brand service centres</strong>: invoice and serial details, only when
              you raise a warranty claim.
            </li>
            <li>
              <strong className="font-semibold">Law enforcement or tax authorities</strong>: where a valid legal
              process requires it.
            </li>
          </ul>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            We do not sell customer data, and we do not share it with advertisers.
          </p>
        </ContentSection>

        <ContentSection eyebrow="Retention & security" title="Kept as long as the ledger needs">
          <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              <Timer className="mb-0.5 mr-1 inline h-4 w-4 text-primary" aria-hidden />
              Order, invoice and tax records are retained for the period required by Indian tax law (GST records are
              conventionally kept for 72 months); account data is kept while your account is active and for a short
              period after deletion requests for legal reconciliation. Inventory audit logs are retained as part of
              the store&apos;s financial controls.
            </p>
            <p>
              <Database className="mb-0.5 mr-1 inline h-4 w-4 text-primary" aria-hidden />
              Access to customer data is limited to staff roles that need it (fulfilment, order desk, accounts).
              Sessions use signed, HTTP-only cookies; passwords do not exist for customers — sign-in is by
              time-limited OTP to your registered number.
            </p>
          </div>
        </ContentSection>

        <ContentSection eyebrow="Your choices" title="Access, correction, deletion">
          <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <p>
              <Scale className="mb-0.5 mr-1 inline h-4 w-4 text-primary" aria-hidden />
              You may review and correct your profile and addresses in your account, request a copy of your data, or
              ask for your account to be deleted — subject to tax records we must legally retain. Grievances are
              heard by the store manager:
            </p>
            <div className="rounded-lg border border-border bg-muted/50 p-5 text-[14px]">
              <p className="flex items-center gap-2 font-medium">
                <Phone className="h-4 w-4 text-primary" aria-hidden /> Grievance contact
              </p>
              <p className="mt-2 text-muted-foreground">
                Patel Networks (MegaTech), Surat Central Hub, Surat, Gujarat {STORE.originPin}
                <br />
                {STORE.supportPhone} · {STORE.email}
              </p>
            </div>
          </div>
        </ContentSection>

        <div className="border-t border-border pt-10 pb-4 lg:pb-8">
          <CtaBand
            title="A question about your data?"
            body="Write to the grievance contact above — we answer privacy requests with the same seriousness as order questions."
            href="/contact"
            ctaLabel="Contact the desk"
            secondaryHref="/terms"
            secondaryLabel="Read the terms of sale"
          />
        </div>
      </ContentContainer>
    </PageShell>
  );
}
