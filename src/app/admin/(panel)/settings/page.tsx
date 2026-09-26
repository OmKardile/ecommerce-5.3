// /admin/settings — store ops config (ADMIN / SUPER_ADMIN can save; others read-only on load).

import { Banknote, CalendarClock, MapPinOff, PackageCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingsForm } from '@/components/admin/settings-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings · Patel Networks Ops' };

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Configuration</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Store-wide operations config. Saving updates checkout pricing, COD rules and announcements immediately.
        </p>
      </div>

      <SettingsForm />

      {/* ADR-004 documentation card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">COD policy — ADR-004 (reference)</CardTitle>
          <p className="text-xs text-muted-foreground">How the server enforces Cash on Delivery — this page only tunes the limits.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
            <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-medium">Order-value ceiling</p>
              <p className="mt-0.5 text-xs text-muted-foreground">COD is rejected above the max order value configured above (default ₹15,000).</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
            <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-medium">Per-product flag</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Products with COD disallowed (isCodAllowed = false) make the whole cart prepaid-only — toggled inline on the Products table.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
            <MapPinOff className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-medium">Zone serviceability</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Air-cargo / special zones (78x, 79x, 19x, 744) are COD-blocked regardless of order value.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-medium">Verification flow</p>
              <p className="mt-0.5 text-xs text-muted-foreground">COD orders land in COD_PENDING → CONFIRMED via the Orders console; the carrier scan marks payment SUCCESS on delivery.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
