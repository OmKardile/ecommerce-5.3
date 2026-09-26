// /admin/reports — commercial reports (server): KPIs, 30-day chart, GSTR-1 schedule,
// top products/customers, inventory valuation. Money via getCommercialReports() (paise).

import { Boxes, CreditCard, IndianRupee, ReceiptText, Truck } from 'lucide-react';
import Link from 'next/link';
import { getCommercialReports } from '@/server/services/admin.service';
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
import { SalesChart } from '@/components/admin/sales-chart';
import { Gstr1Card } from '@/components/admin/gstr1-card';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reports · Patel Networks Ops' };

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

interface ReportsPageProps {
  searchParams: Promise<{ days?: string }>;
}

const PERIODS = [7, 30, 90, 180] as const;

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  const sp = await searchParams;
  const raw = Number(sp.days ?? '30');
  const days = (PERIODS as readonly number[]).includes(raw) ? raw : 30;
  const r = await getCommercialReports(days);
  const periodLabel = `Last ${days} days`; 
  const codPct =
    r.prepaidValuePaise + r.codValuePaise > 0 ? Math.round((r.codValuePaise / (r.prepaidValuePaise + r.codValuePaise)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Finance</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paid-order economics, tax schedule and stock valuation. All figures aggregate settled (paid) orders only.
          </p>
        </div>
        <nav aria-label="Report period" className="flex gap-1.5" role="tablist">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/reports?days=${p}`}
              role="tab"
              aria-selected={p === days}
              aria-current={p === days ? 'true' : undefined}
              className={
                p === days
                  ? 'rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'
                  : 'rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground'
              }
            >
              {p}d
            </Link>
          ))}
        </nav>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label={`GMV (paid) · ${periodLabel}`} value={formatINR(r.gmvPaise)} sub={`${r.ordersCount} orders`} />
        <KpiCard label="AOV" value={formatINR(r.aovPaise)} sub={`average order value · ${periodLabel.toLowerCase()}`} />
        <KpiCard
          label="Prepaid"
          value={formatINR(r.prepaidValuePaise)}
          sub={`${r.prepaidOrders} orders · Razorpay`}
        />
        <KpiCard label="Cash on Delivery" value={formatINR(r.codValuePaise)} sub={`${r.codOrders} orders · ${codPct}% of value`} />
      </div>

      {/* Chart + payment/tax split */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">{periodLabel}</CardTitle>
            <p className="text-xs text-muted-foreground">Daily paid sales (bars = order count)</p>
          </CardHeader>
          <CardContent>
            <SalesChart data={r.dailySales} height={280} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-accent" aria-hidden /> Tax summary
            </CardTitle>
            <p className="text-xs text-muted-foreground">GST-inclusive pricing → liability split</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm">Taxable base</span>
              <span className="font-display text-base">{formatINR(r.taxableBasePaise)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm">CGST (intra-state)</span>
              <span className="font-display text-base">{formatINR(r.cgstPaise)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm">SGST (intra-state)</span>
              <span className="font-display text-base">{formatINR(r.sgstPaise)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm">IGST (inter-state)</span>
              <span className="font-display text-base">{formatINR(r.igstPaise)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-sm font-medium">Total GST</span>
              <span className="font-display text-base">{formatINR(r.cgstPaise + r.sgstPaise + r.igstPaise)}</span>
            </div>
            <p className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
              Filings derive from the GSTR-1 schedule below — invoice-wise B2B/B2C rows with buyer GSTIN (ADR-017).
            </p>
          </CardContent>
        </Card>
      </div>

      {/* GSTR-1 */}
      <Card>
        <CardContent className="pt-6">
          <Gstr1Card />
        </CardContent>
      </Card>

      {/* Top products / customers + inventory valuation */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Top products</CardTitle>
            <p className="text-xs text-muted-foreground">By revenue, paid orders · {periodLabel.toLowerCase()}</p>
          </CardHeader>
          <CardContent>
            {r.topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No sales recorded yet.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto thin-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs text-right">Units</TableHead>
                      <TableHead className="text-xs text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.topProducts.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="max-w-[220px] truncate text-xs">{p.name}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{p.unitsSold}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{formatINR(p.revenuePaise)}</TableCell>
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
            <CardTitle className="font-display text-lg">Top customers</CardTitle>
            <p className="text-xs text-muted-foreground">By paid value · {periodLabel.toLowerCase()}</p>
          </CardHeader>
          <CardContent>
            {r.topCustomers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No customers recorded yet.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto thin-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs text-right">Orders</TableHead>
                      <TableHead className="text-xs text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.topCustomers.map((c) => (
                      <TableRow key={c.phone}>
                        <TableCell className="max-w-[180px]">
                          <p className="truncate text-xs font-medium">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground">{c.phone}</p>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{c.orders}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{formatINR(c.valuePaise)}</TableCell>
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
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Boxes className="h-4 w-4 text-accent" aria-hidden /> Inventory valuation
            </CardTitle>
            <p className="text-xs text-muted-foreground">Physical units × selling price</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm">SKUs tracked</span>
              <span className="font-display text-base">{r.inventoryUnits.toLocaleString('en-IN')} units</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm">Available (unreserved)</span>
              <span className="font-display text-base">{r.inventoryAvailable.toLocaleString('en-IN')} units</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-sm font-medium">Capital in stock</span>
              <span className="font-display text-base">{formatINR(r.inventoryValuePaise)}</span>
            </div>
            <p className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
              Valuation uses current selling price × physical stock. Reserved units belong to confirmed orders until dispatch.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment-method footer strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
          <IndianRupee className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            <p className="label-caps">Payment modes</p>
            <p className="truncate text-xs text-muted-foreground">Razorpay + COD (ceiling ₹15,000)</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
          <CreditCard className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            <p className="label-caps">Prepaid orders</p>
            <p className="truncate text-xs text-muted-foreground">{r.prepaidOrders} captured online</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
          <Truck className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            <p className="label-caps">COD share</p>
            <p className="truncate text-xs text-muted-foreground">{codPct}% of paid value</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
          <ReceiptText className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            <p className="label-caps">Statutory</p>
            <p className="truncate text-xs text-muted-foreground">GSTR-1 exportable monthly</p>
          </div>
        </div>
      </div>
    </div>
  );
}
