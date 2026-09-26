'use client';

// GSTR-1 schedule card — period modes (month / fiscal quarter / custom range)
// → GET /api/admin/reports/gstr1?from=&to=, statutory table + RFC4180 CSV
// export including a totals row (ADR-017). Quarterly mode exists because the
// QRMP scheme lets small taxpayers file GSTR-1 per fiscal quarter
// (Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, Download, FileSearch, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/components/admin/api';
import { formatINR } from '@/lib/money';
import { downloadCsv, toCsv } from '@/components/admin/csv';

interface Gstr1Row {
  orderNumber: string;
  date: string;
  isB2B: boolean;
  gstin: string | null;
  state: string;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  invoiceValuePaise: number;
}

interface Gstr1Totals {
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  invoiceValuePaise: number;
  b2bCount: number;
  b2cCount: number;
}

interface Gstr1Response {
  from: string;
  to: string;
  rows: Gstr1Row[];
  totals: Gstr1Totals;
}

interface PeriodOption {
  value: string;
  label: string;
  from: string;
  to: string;
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const short = (d: Date): string => d.toLocaleDateString('en-IN', { month: 'short' });
const long = (d: Date): string => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** Last 12 calendar months, newest first. */
function monthOptions(now = new Date()): PeriodOption[] {
  const out: PeriodOption[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = new Date(d.getFullYear(), d.getMonth(), 1);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    out.push({ value: `m:${iso(from)}`, label: from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), from: iso(from), to: iso(to) });
  }
  return out;
}

/**
 * Last 8 Indian fiscal quarters, newest first (QRMP filing windows).
 * Q1 = Apr–Jun, Q2 = Jul–Sep, Q3 = Oct–Dec, Q4 = Jan–Mar; the fiscal year
 * tag follows the April in which the quarter started (Apr–Jun 2026 → FY26-27).
 */
function quarterOptions(now = new Date()): PeriodOption[] {
  const out: PeriodOption[] = [];
  // Quarter-start month offset from April, 0-based: Jan→9, Apr→0, Jul→3, Oct→6.
  const off = (now.getMonth() - 3 + 12) % 12;
  const qs = off - (off % 3); // 0 | 3 | 6 | 9
  let cursor = new Date(now.getFullYear(), (3 + qs) % 12, 1);
  for (let i = 0; i < 8; i++) {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 0);
    const startMonth = from.getMonth();
    // Fiscal year that began the preceding April (calendar Jan–Mar closes the previous FY).
    const fyStart = startMonth >= 3 ? from.getFullYear() : from.getFullYear() - 1;
    const fyTag = `${fyStart % 100}-${(fyStart + 1) % 100 < 10 ? `0${(fyStart + 1) % 100}` : (fyStart + 1) % 100}`;
    const qNum = 1 + Math.round(startMonth >= 3 ? (startMonth - 3) / 3 : (startMonth + 9) / 3);
    out.push({
      value: `q:${iso(from)}`,
      label: `${short(from)}–${short(to)} ${to.getFullYear()} · Q${qNum} FY${fyTag}`,
      from: iso(from),
      to: iso(to),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 3, 1);
  }
  return out;
}

type PeriodMode = 'month' | 'quarter' | 'custom';

export function Gstr1Card() {
  const { toast } = useToast();
  const months = useMemo(() => monthOptions(), []);
  const quarters = useMemo(() => quarterOptions(), []);
  const [mode, setMode] = useState<PeriodMode>('month');
  const [selected, setSelected] = useState(months[0].value);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customPeriod, setCustomPeriod] = useState<PeriodOption | null>(null);
  const [data, setData] = useState<Gstr1Response | null>(null);
  const [loading, setLoading] = useState(true);

  const options = mode === 'quarter' ? quarters : months;
  const current: PeriodOption | null =
    mode === 'custom' ? customPeriod : options.find((o) => o.value === selected) ?? options[0];

  const load = useCallback(
    async (period: PeriodOption) => {
      setLoading(true);
      try {
        const res = await api<Gstr1Response>(`/api/admin/reports/gstr1?from=${period.from}&to=${period.to}`);
        setData(res);
      } catch (err) {
        toast({ title: 'Failed to load GSTR-1 schedule', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (mode === 'custom') return; // custom loads via Apply only
    const period = (mode === 'quarter' ? quarters : months).find((o) => o.value === selected);
    if (period) void load(period);
  }, [mode, selected, months, quarters, load]);

  function applyCustomRange() {
    if (!customFrom || !customTo) {
      toast({ title: 'Pick both dates', description: 'A custom GSTR-1 range needs a start and an end date.', variant: 'destructive' });
      return;
    }
    if (customTo < customFrom) {
      toast({ title: 'End date is before the start date', description: 'Swap the two dates and apply again.', variant: 'destructive' });
      return;
    }
    const spanDays = Math.round((Date.parse(customTo) - Date.parse(customFrom)) / 86400000) + 1;
    if (spanDays > 366) {
      toast({ title: 'Range too long', description: 'Keep the custom range within 366 days — split longer spans into monthly or quarterly filings.', variant: 'destructive' });
      return;
    }
    const period: PeriodOption = { value: 'c:custom', label: 'Custom range', from: customFrom, to: customTo };
    setCustomPeriod(period);
    void load(period);
  }

  function exportCsv() {
    if (!data || !current) return;
    const csv = toCsv(
      ['Invoice No', 'Date', 'Type', 'GSTIN', 'Place of Supply', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Invoice Value'],
      [
        ...data.rows.map((r) => [
          r.orderNumber,
          r.date,
          r.isB2B ? 'B2B' : 'B2C',
          r.gstin ?? '',
          r.state,
          (r.taxableValuePaise / 100).toFixed(2),
          (r.cgstPaise / 100).toFixed(2),
          (r.sgstPaise / 100).toFixed(2),
          (r.igstPaise / 100).toFixed(2),
          (r.totalTaxPaise / 100).toFixed(2),
          (r.invoiceValuePaise / 100).toFixed(2),
        ]),
        // totals row (statutory filing convenience)
        [
          'TOTAL',
          `${data.from} to ${data.to}`,
          `B2B: ${data.totals.b2bCount} / B2C: ${data.totals.b2cCount}`,
          '',
          '',
          (data.totals.taxableValuePaise / 100).toFixed(2),
          (data.totals.cgstPaise / 100).toFixed(2),
          (data.totals.sgstPaise / 100).toFixed(2),
          (data.totals.igstPaise / 100).toFixed(2),
          (data.totals.totalTaxPaise / 100).toFixed(2),
          (data.totals.invoiceValuePaise / 100).toFixed(2),
        ],
      ]
    );
    downloadCsv(`gstr1_${data.from}_to_${data.to}.csv`, csv);
    toast({ title: 'GSTR-1 schedule exported', description: `${data.rows.length} invoices · ${data.from} → ${data.to}` });
  }

  const periodSummary = !current
    ? 'Pick a start and end date, then Apply.'
    : mode === 'quarter'
      ? `${long(new Date(current.from))} – ${long(new Date(current.to))} · quarterly return (QRMP window)`
      : mode === 'custom'
        ? `${long(new Date(current.from))} – ${long(new Date(current.to))} · custom range`
        : `${long(new Date(current.from))} – ${long(new Date(current.to))} · monthly return`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">GSTR-1 filing schedule</h2>
          <p className="text-xs text-muted-foreground">B2B invoices carry the buyer GSTIN for input tax credit matching.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={exportCsv}
          disabled={!data || data.rows.length === 0}
          title={!data || data.rows.length === 0 ? 'No taxable invoices in this period yet — the export unlocks with the first invoice.' : 'Download GSTR-1 rows (RFC4180) with a totals row'}
        >
          <Download className="h-4 w-4" aria-hidden /> CSV
        </Button>
      </div>

      {/* period controls: mode toggle + picker (or date pair) */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Plain button group (matches the app's other role=tablist controls) —
            Radix Tabs activation proved flaky under automated input in QA. */}
        <div role="tablist" aria-label="Period mode" className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted p-[3px]">
          {([
            { v: 'month' as const, label: 'Month' },
            { v: 'quarter' as const, label: 'Quarter' },
            { v: 'custom' as const, label: 'Custom' },
          ]).map((m) => (
            <button
              key={m.v}
              role="tab"
              aria-selected={mode === m.v}
              onClick={() => {
                setMode(m.v);
                setSelected((m.v === 'quarter' ? quarters : months)[0].value);
              }}
              className={
                mode === m.v
                  ? 'rounded-md bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm'
                  : 'rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'
              }
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode !== 'custom' ? (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-[250px]" aria-label="Report period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="Custom range start"
              className="w-[150px] text-xs"
            />
            <span className="text-xs text-muted-foreground" aria-hidden>→</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="Custom range end"
              className="w-[150px] text-xs"
            />
            <Button size="sm" variant="outline" onClick={applyCustomRange} disabled={!customFrom || !customTo}>
              <CalendarRange className="h-4 w-4" aria-hidden /> Apply
            </Button>
          </div>
        )}
      </div>
      <p className="-mt-2 text-[11px] text-muted-foreground">
        <CalendarRange className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />
        {periodSummary}
      </p>

      {/* period totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Invoices', value: String(data?.rows.length ?? 0), plain: true },
          { label: 'B2B · B2C', value: `${data?.totals.b2bCount ?? 0} · ${data?.totals.b2cCount ?? 0}`, plain: true },
          { label: 'Taxable value', value: formatINR(data?.totals.taxableValuePaise ?? 0), plain: false },
          { label: 'CGST + SGST', value: formatINR((data?.totals.cgstPaise ?? 0) + (data?.totals.sgstPaise ?? 0)), plain: false },
          { label: 'IGST', value: formatINR(data?.totals.igstPaise ?? 0), plain: false },
          { label: 'Invoice value', value: formatINR(data?.totals.invoiceValuePaise ?? 0), plain: false },
        ].map((t) => (
          <div key={t.label} className="rounded-md border border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/30">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</p>
            {loading ? (
              <span className="mt-1 block h-5 w-16 animate-pulse rounded bg-muted" aria-hidden />
            ) : (
              <p className="mt-0.5 font-display text-base tabular-nums">{t.value}</p>
            )}
          </div>
        ))}
      </div>

      <div className="max-h-96 overflow-y-auto thin-scrollbar rounded-md border border-border">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Invoice</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">GSTIN</TableHead>
              <TableHead className="text-xs">State</TableHead>
              <TableHead className="text-xs text-right">Taxable</TableHead>
              <TableHead className="text-xs text-right">CGST</TableHead>
              <TableHead className="text-xs text-right">SGST</TableHead>
              <TableHead className="text-xs text-right">IGST</TableHead>
              <TableHead className="text-xs text-right">Invoice value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden />
                  <span className="sr-only">Loading GSTR-1 schedule</span>
                </TableCell>
              </TableRow>
            ) : !data || data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center">
                  <FileSearch className="mx-auto h-6 w-6 text-muted-foreground/50" aria-hidden />
                  <p className="mt-2 text-sm text-muted-foreground">No taxable invoices in this period.</p>
                  <p className="text-xs text-muted-foreground/70">PAID orders appear here once their GST invoice is issued.</p>
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((r) => (
                <TableRow key={r.orderNumber}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{r.orderNumber}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{r.date}</TableCell>
                  <TableCell className="text-xs">
                    <span className={r.isB2B ? 'font-medium text-foreground' : 'text-muted-foreground'}>{r.isB2B ? 'B2B' : 'B2C'}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-[11px]">{r.gstin ?? '—'}</TableCell>
                  <TableCell className="max-w-[120px] truncate text-xs">{r.state}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{formatINR(r.taxableValuePaise)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{r.cgstPaise ? formatINR(r.cgstPaise) : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{r.sgstPaise ? formatINR(r.sgstPaise) : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{r.igstPaise ? formatINR(r.igstPaise) : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs font-medium tabular-nums">{formatINR(r.invoiceValuePaise)}</TableCell>
                </TableRow>
              ))
            )}
            {data && data.rows.length > 0 && (
              <TableRow className="bg-muted/60 font-medium">
                <TableCell className="text-xs" colSpan={5}>
                  Totals · B2B {data.totals.b2bCount} / B2C {data.totals.b2cCount}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{formatINR(data.totals.taxableValuePaise)}</TableCell>
                <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{formatINR(data.totals.cgstPaise)}</TableCell>
                <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{formatINR(data.totals.sgstPaise)}</TableCell>
                <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{formatINR(data.totals.igstPaise)}</TableCell>
                <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{formatINR(data.totals.invoiceValuePaise)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
