// Admin panel layout — dark ops chrome around every authenticated admin page.
// /admin/login intentionally sits OUTSIDE this route group so it renders standalone.
// STAFF sessions (ADR-010) are fenced to /admin/stock-monitor* via the x-pathname
// header set by the proxy — every other console page redirects for that role.

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getAdminSession } from '@/lib/session';
import { ROLES } from '@/lib/constants';
import { countOpenReturns } from '@/server/services/order.service';
import { db } from '@/lib/db';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');

  const isStaff = session.role === ROLES.STAFF;
  if (isStaff) {
    const pathname = (await headers()).get('x-pathname') ?? '/admin';
    if (!pathname.startsWith('/admin/stock-monitor')) redirect('/admin/stock-monitor');
  }

  const [pendingReturns, newInquiries, pendingReviews] = isStaff
    ? [0, 0, 0]
    : await Promise.all([
        countOpenReturns().catch(() => 0),
        db.b2BInquiry.count({ where: { status: 'NEW' } }).catch(() => 0),
        db.review.count({ where: { isApproved: false } }).catch(() => 0),
      ]);
  return (
    <AdminShell session={{ userId: session.userId, email: session.email, fullName: session.fullName, role: session.role }} badges={{ pendingReturns, newInquiries, pendingReviews }}>
      {children}
    </AdminShell>
  );
}
