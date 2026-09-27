// /admin/stock-monitor — ADR-010 observe-and-report console for counter/floor
// staff (STAFF role) and managers. Read-only wall + count sheets + proposals.

import { getAdminSession } from '@/lib/session';
import { StockMonitor } from '@/components/admin/stock-monitor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Stock Monitor · Patel Networks Ops' };

export default async function AdminStockMonitorPage() {
  const session = await getAdminSession();
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Floor operations</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Stock Monitor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What is actually on the shelf right now — available is physical minus reserved. Observe and report; managers dispose.
        </p>
      </div>
      <StockMonitor role={session?.role ?? ''} />
    </div>
  );
}
