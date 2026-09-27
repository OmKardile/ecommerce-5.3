// Admin panel layout — dark ops chrome around every authenticated admin page.
// /admin/login intentionally sits OUTSIDE this route group so it renders standalone.
// Access control (D-12): the operator's User row is re-read fresh — Owner sees
// every section; Staff see only the sections their granted scopes cover, and
// any deep-link into a non-granted section bounces to their landing page
// (their first granted section). The x-pathname header comes from the proxy.

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getAdminSession } from '@/lib/session';
import { ROLES, parsePermissions, type PermissionScope } from '@/lib/constants';
import { db } from '@/lib/db';
import { countOpenReturns } from '@/server/services/order.service';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

/** Console sections guarded by a permission scope. `/admin` itself is staff-safe. */
const SECTIONS: Array<{ prefix: string; scope: PermissionScope | 'staff' }> = [
  { prefix: '/admin/orders', scope: 'orders' },
  { prefix: '/admin/returns', scope: 'returns' },
  { prefix: '/admin/products', scope: 'products' },
  { prefix: '/admin/categories', scope: 'categories' },
  { prefix: '/admin/brands', scope: 'brands' },
  { prefix: '/admin/inventory', scope: 'inventory' },
  { prefix: '/admin/stock-monitor', scope: 'stock_monitor' },
  { prefix: '/admin/customers', scope: 'customers' },
  { prefix: '/admin/inquiries', scope: 'inquiries' },
  { prefix: '/admin/reviews', scope: 'reviews' },
  { prefix: '/admin/coupons', scope: 'coupons' },
  { prefix: '/admin/banners', scope: 'banners' },
  { prefix: '/admin/blog', scope: 'blog' },
  { prefix: '/admin/reports', scope: 'reports' },
  { prefix: '/admin/settings', scope: 'settings' },
  { prefix: '/admin/staff', scope: 'staff' }, // inherently owner-only
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true, deletedAt: true, permissions: true, fullName: true, email: true },
  });
  if (!user || user.deletedAt || !user.isActive || user.role === ROLES.CUSTOMER) {
    // Stale-but-valid JWT (user wiped/recreated/deactivated): route through
    // /admin/logout so the dead cookie is CLEARED — /admin/login alone would
    // loop, since the proxy bounces cookie-holders straight back to /admin.
    redirect('/admin/logout');
  }

  const isOwner = user.role === ROLES.SUPER_ADMIN;
  const permissions = parsePermissions(user.permissions);
  const pathname = (await headers()).get('x-pathname') ?? '/admin';

  // Section gate: staff deep-linking into a non-granted section (or anyone but
  // the owner into staff management) is bounced to their landing page.
  const section = SECTIONS.find((s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`));
  if (section) {
    const allowed = isOwner || (section.scope !== 'staff' && permissions.includes(section.scope));
    if (!allowed) redirect(landingFor(permissions));
  }

  // Staff landing: their first granted section replaces the dashboard (which
  // stays owner/scope-less-staff territory). `/admin/login` never lands here.
  if (!isOwner && (pathname === '/admin' || pathname === '/admin/') && permissions.length > 0) {
    redirect(landingFor(permissions));
  }

  const [pendingReturns, newInquiries, pendingReviews] = await Promise.all([
    countOpenReturns().catch(() => 0),
    db.b2BInquiry.count({ where: { status: 'NEW' } }).catch(() => 0),
    db.review.count({ where: { isApproved: false } }).catch(() => 0),
  ]);

  return (
    <AdminShell
      session={{
        userId: session.userId,
        email: user.email ?? session.email,
        fullName: user.fullName ?? session.fullName,
        role: user.role,
        permissions,
        isOwner,
      }}
      badges={{ pendingReturns, newInquiries, pendingReviews }}
    >
      {children}
    </AdminShell>
  );
}

function landingFor(permissions: PermissionScope[]): string {
  const first = permissions.find((p) => SECTIONS.some((s) => s.scope === p));
  return first ? (SECTIONS.find((s) => s.scope === first)!.prefix) : '/admin';
}
