// /admin/staff — owner-only console (D-12): accounts table + a creation wizard
// (identity → account type → function scopes → review) + owner self-service
// login change. Staff scope edits take effect on the staff's next request.

import { StaffConsole } from '@/components/admin/staff-console';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Staff & access · Patel Networks Ops' };

export default function AdminStaffPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Access control</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Staff &amp; access</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          You are the Owner — everything is open to you, always. Everyone else is Staff: create
          their account, pick exactly which functions they get, change it any time. Scope edits
          apply on their very next request — no re-login needed.
        </p>
      </div>
      <StaffConsole />
    </div>
  );
}
