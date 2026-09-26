// /admin — operations dashboard (server component): KPIs, 30-day chart, payment split,
// low-stock watchlist, quick links. All money math via existing services (paise → formatINR).

import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  ClipboardList,
  PackagePlus,
  RotateCcw,
  Tag,
  TriangleAlert,
  Warehouse,
} from 'lucide-react';
import { getDashboardMetrics, getCommercialReports, getRecentActivity, type ActivityItem } from '@/server/services/admin.service';
import { formatINR } from '@/lib/money';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SalesChart } from '@/components/admin/sales-chart';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard · Patel Networks Ops' };

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="label-caps">{label}</p>
        <p className="mt-1.5 font-display text-2xl leading-none text-foreground">{value}</p>
        {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function PipelineCard({ label, count, href, tone }: { label: string; count: number | string; href?: string; tone?: 'alert' }) {
  const body = (
    <>
      <p className={`font-display text-xl leading-none ${tone === 'alert' && Number(count) > 0 ? 'text-destructive' : ''}`}>{count}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </>
  );
  const cls = 'block rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/60';
  return href ? (
    <Link href={href} className={cls}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const ACTIVITY_TONE_ICON: Record<ActivityItem['tone'], { icon: typeof Tag; cls: string }> = {
  order: { icon: ClipboardList, cls: 'bg-primary/10 text-primary' },
  return: { icon: RotateCcw, cls: 'bg-accent/15 text-accent-foreground' },
  stock: { icon: Warehouse, cls: 'bg-muted text-foreground' },
  promo: { icon: Tag, cls: 'bg-muted text-foreground' },
  system: { icon: ArrowRight, cls: 'bg-muted text-muted-foreground' },
};

function relTime(d: Date): string {
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);
}

function RecentActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="font-display text-lg">Recent activity</CardTitle>
          <p className="text-xs text-muted-foreground">Latest audited events across orders, returns, stock &amp; promotions</p>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="thin-scrollbar max-h-80 divide-y divide-border/70 overflow-y-auto">
            {items.map((item) => {
              const { icon: Icon, cls } = ACTIVITY_TONE_ICON[item.tone];
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cls}`} aria-hidden>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{item.label}</span>
                      {item.subject && <span className="ml-1.5 font-mono text-xs text-muted-foreground">{item.subject}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">by {item.actorName}</p>
                  </div>
                  <time className="shrink-0 text-[11px] text-muted-foreground">{relTime(item.at)}</time>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const [m, reports, activity] = await Promise.all([getDashboardMetrics(), getCommercialReports(), getRecentActivity(12)]);
  const aovPaise = m.totalOrders ? Math.round(m.gmvPaise / m.totalOrders) : 0;
  const payTotal = reports.prepaidValuePaise + reports.codValuePaise;
  const prepaidPct = payTotal ? Math.round((reports.prepaidValuePaise / payTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Surat Central Hub</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl">Operations dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/products/new">
              <PackagePlus className="h-4 w-4" aria-hidden /> New product
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/orders">
              <ClipboardList className="h-4 w-4" aria-hidden /> Fulfillment console
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <KpiCard label="GMV (paid)" value={formatINR(m.gmvPaise)} sub={`${m.totalOrders} paid orders`} />
        <KpiCard label="GST collected" value={formatINR(m.gstCollectedPaise)} sub="CGST + SGST + IGST" />
        <KpiCard label="AOV" value={formatINR(aovPaise)} sub="average order value" />
        <KpiCard label="Today" value={formatINR(m.todaySalesPaise)} sub="sales since midnight" />
        <KpiCard label="This month" value={formatINR(m.monthSalesPaise)} sub="month-to-date sales" />
      </div>

      {/* Chart + payment split */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Last 30 days</CardTitle>
            <p className="text-xs text-muted-foreground">Daily paid sales (bars = order count)</p>
          </CardHeader>
          <CardContent>
            <SalesChart data={m.dailySales} height={280} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Payment split</CardTitle>
            <p className="text-xs text-muted-foreground">Prepaid vs Cash on Delivery</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Prepaid (Razorpay)</span>
                <span className="font-display text-lg">{formatINR(reports.prepaidValuePaise)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{reports.prepaidOrders} orders</p>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Cash on Delivery</span>
                <span className="font-display text-lg">{formatINR(reports.codValuePaise)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{reports.codOrders} orders</p>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{prepaidPct}% prepaid</span>
                <span>{100 - prepaidPct}% COD</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${prepaidPct}%` }} />
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
              <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <p>
                COD ceiling ₹15,000 per order, per-product flag &amp; air-cargo zone rules apply (ADR-004). Manage in{' '}
                <Link href="/admin/settings" className="underline underline-offset-2 hover:text-foreground">
                  Settings
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline */}
      <section aria-label="Order pipeline">
        <h2 className="label-caps mb-2">Order pipeline</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <PipelineCard label="Pending / COD verify" count={m.pendingOrders} href="/admin/orders?status=PENDING_PAYMENT" />
          <PipelineCard label="Processing" count={m.processingOrders} href="/admin/orders?status=PROCESSING" />
          <PipelineCard label="Shipped" count={m.shippedOrders} href="/admin/orders?status=SHIPPED" />
          <PipelineCard label="Delivered" count={m.deliveredOrders} href="/admin/orders?status=DELIVERED" />
          <PipelineCard label="Cancelled" count={m.cancelledOrders} href="/admin/orders?status=CANCELLED" />
        </div>
      </section>

      {/* After-sales & promotions */}
      <section aria-label="After-sales and promotions">
        <h2 className="label-caps mb-2">After-sales &amp; promotions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <PipelineCard label="Open returns / RMA" count={m.openReturns} href="/admin/returns" tone={m.openReturns > 0 ? 'alert' : undefined} />
          <PipelineCard label="Back-in-stock watchers" count={m.pendingStockAlerts} href="/admin/inventory" />
          <PipelineCard label="Coupon redemptions · 30d" count={m.couponRedemptions30d} href="/admin/coupons" />
          <PipelineCard label="Discount given · 30d" count={formatINR(m.couponDiscount30dPaise)} href="/admin/coupons" />
        </div>
      </section>

      {/* Recent activity (audit tail) */}
      <RecentActivityCard items={activity} />

      {/* Low stock + quick links */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-accent" aria-hidden /> Low stock watchlist
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {m.lowStock.length} at/below threshold · {m.outOfStock} SKUs out of stock
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/inventory">
                <Warehouse className="h-4 w-4" aria-hidden /> Inventory
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {m.lowStock.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">All SKUs are above their low-stock thresholds.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto thin-scrollbar rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs">Variant</TableHead>
                      <TableHead className="text-xs text-right">Available</TableHead>
                      <TableHead className="text-xs text-right">Threshold</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {m.lowStock.map((row) => (
                      <TableRow key={row.skuCode}>
                        <TableCell className="font-mono text-xs">{row.skuCode}</TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate">{row.productName}</TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">{row.variantName}</TableCell>
                        <TableCell className="text-right">
                          <span className={row.available === 0 ? 'text-destructive font-medium' : 'text-accent font-medium'}>{row.available}</span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{row.threshold}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {[
              { href: '/admin/orders', label: 'Fulfillment console — book AWBs, capture serials' },
              { href: '/admin/inventory', label: 'Inventory — adjustments, CSV import/export' },
              { href: '/admin/reports', label: 'Reports & GSTR-1 schedule' },
              { href: '/admin/customers', label: 'Customer directory (B2B CRM)' },
              { href: '/admin/coupons', label: 'Coupons & promotions' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition-colors hover:border-border hover:bg-muted/60"
              >
                <span>
                  <span className="font-medium">{l.label.split(' — ')[0]}</span>
                  <span className="block text-xs text-muted-foreground">{l.label.split(' — ')[1] ?? ''}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
