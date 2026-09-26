// Admin panel layout — dark ops chrome around every authenticated admin page.
// /admin/login intentionally sits OUTSIDE this route group so it renders standalone.

import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/session';
import { countOpenReturns } from '@/server/services/order.service';
import { db } from '@/lib/db';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  const [pendingReturns, newInquiries] = await Promise.all([
    countOpenReturns().catch(() => 0),
    db.b2BInquiry.count({ where: { status: 'NEW' } }).catch(() => 0),
  ]);
  return (
    <AdminShell session={{ userId: session.userId, email: session.email, fullName: session.fullName, role: session.role }} badges={{ pendingReturns, newInquiries }}>
      {children}
    </AdminShell>
  );
}
