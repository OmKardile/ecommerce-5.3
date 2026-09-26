// /admin/customers — CRM directory (client island).

import { CustomerDirectory } from '@/components/admin/customer-directory';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customers · Patel Networks Ops' };

export default async function AdminCustomersPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">CRM</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Retail and B2B contractors — lifetime value counts paid orders only. Verified GSTINs enable input tax credit.
        </p>
      </div>
      <CustomerDirectory />
    </div>
  );
}
