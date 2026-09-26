// /admin/inquiries — trade desk pipeline for B2B / wholesale quote requests.

import { InquiryInbox } from '@/components/admin/inquiry-inbox';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Trade Desk · Patel Networks Ops' };

export default async function AdminInquiriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Trade desk</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">B2B Inquiries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quote requests from the storefront contact form — call or WhatsApp the buyer back, log the quoted price, and walk the deal forward.
        </p>
      </div>
      <InquiryInbox />
    </div>
  );
}
