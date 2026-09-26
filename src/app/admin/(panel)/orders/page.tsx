// /admin/orders — fulfillment console (client island inside the server shell).

import { OrderFulfillmentConsole } from '@/components/admin/order-console';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders · Patel Networks Ops' };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Fulfillment</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm, pack, ship and track. Serial numbers captured here feed RMA / warranty claims.
        </p>
      </div>
      <OrderFulfillmentConsole initialStatus={status ?? 'ALL'} />
    </div>
  );
}
