// /admin/returns — RMA queue: customer return & DOA requests driven through
// REQUESTED → APPROVED → RESTOCKED → REFUNDED (rejects reinstate the order).

import { ReturnsQueue } from '@/components/admin/returns-queue';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Returns · Patel Networks Ops' };

export default function AdminReturnsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">After-sales</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Returns &amp; DOA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customer return requests within the 7-day DOA window. Approve to schedule pickup, restock on unit receipt, refund last. Every action is audit-logged.
        </p>
      </div>
      <ReturnsQueue />
    </div>
  );
}
