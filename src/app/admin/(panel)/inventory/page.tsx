// /admin/inventory — stock operations console (client islands in tabs):
// "Stock levels" = SKU matrix + adjustments + CSV; "Requests & counts" = the
// manager side of the stock monitor (ADR-010) — approve proposals, apply variances.

import { InventoryConsole } from '@/components/admin/inventory-console';
import { StockRequestsConsole } from '@/components/admin/stock-requests-console';
import { ConsoleTabs } from '@/components/admin/console-tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inventory · Patel Networks Ops' };

export default async function AdminInventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Warehouse</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stock lives only at SKU level (current − reserved = available). Every movement is immutable and audited.
        </p>
      </div>
      <ConsoleTabs
        tabs={[
          { value: 'stock', label: 'Stock levels', content: <InventoryConsole /> },
          { value: 'requests', label: 'Requests & counts', content: <StockRequestsConsole /> },
        ]}
      />
    </div>
  );
}
