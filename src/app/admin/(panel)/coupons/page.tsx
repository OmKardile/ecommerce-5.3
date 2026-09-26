// /admin/coupons — promotions (code, PERCENT/FIXED value, validity, usage, active)
// + per-coupon usage analytics (real redemption rows: discount given, last used).

import { Tag } from 'lucide-react';
import { CouponManager } from '@/components/admin/coupon-manager';
import { getCouponAnalytics } from '@/server/services/admin.service';
import { formatINR } from '@/lib/money';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Coupons · Patel Networks Ops' };

function describeCoupon(type: string, value: number): string {
  return type === 'PERCENT' ? `${value}% off` : `${formatINR(value)} flat`;
}

export default async function AdminCouponsPage() {
  const analytics = await getCouponAnalytics();
  const active = analytics.filter((c) => c.isActive).length;
  const totalGiven = analytics.reduce((n, c) => n + c.discountGivenPaise, 0);
  const totalRedemptions = analytics.reduce((n, c) => n + c.redemptionCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps">Marketing</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">Coupons</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cart-level promotions validated server-side at checkout. PERCENT = 1-100%, FIXED = flat rupee amount.
        </p>
      </div>
      <CouponManager />

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Tag className="h-4 w-4 text-accent" aria-hidden /> Usage analytics
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {totalRedemptions} redemption{totalRedemptions === 1 ? '' : 's'} · {formatINR(totalGiven)} discount given · {active}/{analytics.length} codes active
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {analytics.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No coupons yet — create the first code above.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto thin-scrollbar rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Code</TableHead>
                    <TableHead className="text-xs">Offer</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Used / limit</TableHead>
                    <TableHead className="text-xs text-right">Discount given</TableHead>
                    <TableHead className="text-xs text-right">Last used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-medium">{c.code}</TableCell>
                      <TableCell className="text-xs">{describeCoupon(c.type, c.value)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={c.isActive ? 'border-primary/40 text-primary text-[10px]' : 'text-[10px] text-muted-foreground'}>
                          {c.isActive ? 'Active' : 'Paused'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {c.usedCount}
                        <span className="text-muted-foreground"> / {c.usageLimit ?? '∞'}</span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">{c.redemptionCount > 0 ? formatINR(c.discountGivenPaise) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {c.lastUsedAt ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(c.lastUsedAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
