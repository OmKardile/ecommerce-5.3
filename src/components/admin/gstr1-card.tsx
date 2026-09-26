'use client';

// GSTR-1 schedule card — month selector → GET /api/admin/reports/gstr1?from=&to=,
// statutory table + RFC4180 CSV export including a totals row (ADR-017).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

/** Last 12 calendar months, newest first (label + from/to ISO dates). */
function monthOptions(now = new Date()): { value: string; label: string; from: string; to: string }[] {
  const out: { value: string; label: string; from: string; to: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = new Date(d.getFullYear(), d.getMonth(), 1);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
  }
  return out;
}

export function Gstr1Card() {
  const { toast } = useToast();
  const months = useMemo(() => monthOptions(), []);
  const [selected, setSelected] = useState(months[0].value);
  const [data, setData] = useState<Gstr1Response | null>(null);
  const [loading, setLoading] = useState(true);

  const current = months.find((m) => m.value === selected) ?? months[0];

  const load = useCallback(
    async (monthValue: string) => {
      const m = months.find((x) => x.value === monthValue) ?? months[0];
      setLoading(true);
      try {
        const res = await api<Gstr1Response>(`/api/admin/reports/gstr1?from=${m.from}&to=${m.to}`);
        setData(res);
      } catch (err) {
        toast({ title: 'Failed to load GSTR-1 schedule', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [months, toast]
  );

  useEffect(() => {
    void load(selected);
  }, [load, selected]);

  function exportCsv() {
    if (!data) return;
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">GSTR-1 filing schedule</h2>
          <p className="text-xs text-muted-foreground">B2B invoices carry the buyer GSTIN for input tax credit matching.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-[190px]" aria-label="Report month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data || data.rows.length === 0}>
            <Download className="h-4 w-4" aria-hidden /> CSV
          </Button>
        </div>
      </div>

      {/* period totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Invoices', value: String(data?.rows.length ?? 0) },
          { label: 'Taxable value', value: formatINR(data?.totals.taxableValuePaise ?? 0) },
          { label: 'CGST + SGST', value: formatINR((data?.totals.cgstPaise ?? 0) + (data?.totals.sgstPaise ?? 0)) },
          { label: 'IGST', value: formatINR(data?.totals.igstPaise ?? 0) },
          { label: 'Invoice value', value: formatINR(data?.totals.invoiceValuePaise ?? 0) },
        ].map((t) => (
          <div key={t.label} className="rounded-md border border-border bg-background px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</p>
            <p className="mt-0.5 font-display text-base">{loading && t.label !== 'Invoices' ? '…' : t.value}</p>
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
                </TableCell>
              </TableRow>
            ) : !data || data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  No taxable invoices in this period.
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
