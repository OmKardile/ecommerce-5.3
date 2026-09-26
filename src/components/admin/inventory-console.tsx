'use client';

// InventoryConsole — SKU matrix with availability meters, manual adjustments with reason
// codes, movement history, CSV export (server-generated) and CSV import (client-parsed).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  History,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api, formatDate } from '@/components/admin/api';
import { MovementReasonBadge } from '@/components/admin/status-badge';
import { parseCsv, downloadCsv, toCsv } from '@/components/admin/csv';

interface InventoryRow {
  skuId: string;
  skuCode: string;
  productName: string;
  variantName: string;
  currentStock: number;
  reservedStock: number;
  available: number;
  lowStockThreshold: number;
  updatedAt: string;
}

interface MovementRow {
  id: string;
  quantity: number;
  reason: string;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
}

type StatusFilter = 'ALL' | 'OK' | 'LOW' | 'OUT';

const MANUAL_REASONS = ['PURCHASE_RECEIPT', 'MANUAL_ADJUSTMENT', 'DAMAGED_WRITE_OFF', 'RETURN_RESTOCK'] as const;

export function InventoryConsole() {
  const { toast } = useToast();
  const [rows, setRows] = useState<InventoryRow[] | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [adjustTarget, setAdjustTarget] = useState<InventoryRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<InventoryRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ rows: InventoryRow[] }>('/api/admin/inventory');
      setRows(res.rows);
    } catch (err) {
      toast({ title: 'Failed to load inventory', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
      setRows([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !`${r.skuCode} ${r.productName} ${r.variantName}`.toLowerCase().includes(needle)) return false;
      if (statusFilter === 'OUT') return r.available <= 0;
      if (statusFilter === 'LOW') return r.available > 0 && r.available <= r.lowStockThreshold;
      if (statusFilter === 'OK') return r.available > r.lowStockThreshold;
      return true;
    });
  }, [rows, q, statusFilter]);

  function statusOf(r: InventoryRow): 'OK' | 'LOW' | 'OUT' {
    if (r.available <= 0) return 'OUT';
    if (r.available <= r.lowStockThreshold) return 'LOW';
    return 'OK';
  }

  async function exportCsv() {
    try {
      const res = await fetch('/api/admin/inventory/export');
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const text = await res.text();
      downloadCsv(`patel-inventory-${new Date().toISOString().slice(0, 10)}.csv`, text);
    } catch (err) {
      toast({ title: 'Export failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }

  async function importCsv(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const table = parseCsv(text);
      if (table.length < 2) throw new Error('CSV needs a header row and at least one data row');
      const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
      const idxSku = header.indexOf('sku_code');
      const idxDelta = header.indexOf('delta');
      const idxReason = header.indexOf('reason');
      const idxNotes = header.indexOf('notes');
      if (idxSku === -1 || idxDelta === -1 || idxReason === -1) {
        throw new Error('Required columns: sku_code, delta, reason (notes optional)');
      }
      const payloadRows = table.slice(1).map((cells) => ({
        skuCode: (cells[idxSku] ?? '').trim(),
        delta: Math.round(Number((cells[idxDelta] ?? '').trim())),
        reason: (cells[idxReason] ?? '').trim().toUpperCase(),
        notes: idxNotes >= 0 ? (cells[idxNotes] ?? '').trim() : undefined,
      }));
      const res = await api<{ total: number; adjusted: number; failed: number; results: { skuCode: string; ok: boolean; error?: string }[] }>(
        '/api/admin/inventory/import',
        { method: 'POST', body: JSON.stringify({ rows: payloadRows }) }
      );
      toast({
        title: `Import finished — ${res.adjusted}/${res.total} rows applied`,
        description: res.failed > 0 ? `${res.failed} row(s) failed: ${res.results.filter((r) => !r.ok).map((r) => `${r.skuCode} (${r.error})`).slice(0, 3).join('; ')}` : 'All stock movements audited.',
        variant: res.failed > 0 ? 'destructive' : 'default',
      });
      await load();
    } catch (err) {
      toast({ title: 'Import failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function downloadTemplate() {
    const csv = toCsv(['sku_code', 'delta', 'reason', 'notes'], [['CPP-B01-2MP-36', '10', 'PURCHASE_RECEIPT', 'GRN-1042'], ['MTC-CAT6-305', '-2', 'DAMAGED_WRITE_OFF', 'Water damage, box 3']]);
    downloadCsv('inventory-import-template.csv', csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU, product, variant…" className="pl-9 h-9" aria-label="Search inventory" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by stock status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="OK">OK</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="OUT">Out of stock</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} aria-label="Refresh">
            <RefreshCw className={cn('h-4 w-4', rows === null && 'animate-spin')} aria-hidden /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />} Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Inventory import CSV file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
            }}
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="max-h-[620px] overflow-auto thin-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">SKU</TableHead>
                <TableHead className="text-xs">Product / variant</TableHead>
                <TableHead className="text-xs text-right">Physical</TableHead>
                <TableHead className="text-xs text-right">Reserved</TableHead>
                <TableHead className="text-xs text-right">Available</TableHead>
                <TableHead className="text-xs w-[130px]">Meter</TableHead>
                <TableHead className="text-xs text-center">Threshold</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows === null ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    {rows.length === 0 ? 'No inventory records — create products first.' : 'Nothing matches this filter.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const st = statusOf(r);
                  const meterPct = r.currentStock > 0 ? Math.min(100, Math.round((r.available / r.currentStock) * 100)) : 0;
                  return (
                    <TableRow key={r.skuId}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{r.skuCode}</TableCell>
                      <TableCell>
                        <p className="text-xs font-medium max-w-[220px] truncate">{r.productName}</p>
                        <p className="text-[11px] text-muted-foreground max-w-[220px] truncate">{r.variantName}</p>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.currentStock}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{r.reservedStock}</TableCell>
                      <TableCell className="text-right text-xs font-semibold tabular-nums">{r.available}</TableCell>
                      <TableCell>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div
                            className={cn('h-full rounded-full', st === 'OUT' ? 'bg-destructive' : st === 'LOW' ? 'bg-accent' : 'bg-primary')}
                            style={{ width: `${st === 'OUT' ? 100 : meterPct}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs tabular-nums text-muted-foreground">{r.lowStockThreshold}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            'inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            st === 'OUT' && 'border-destructive/30 bg-destructive/10 text-destructive',
                            st === 'LOW' && 'border-accent/30 bg-accent/10 text-accent-foreground',
                            st === 'OK' && 'border-primary/25 bg-primary/10 text-primary'
                          )}
                        >
                          {st}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAdjustTarget(r)}>
                            <SlidersHorizontal className="h-3 w-3" aria-hidden /> Adjust
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setHistoryTarget(r)} aria-label={`Movement history for ${r.skuCode}`}>
                            <History className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {filtered.length} of {rows?.length ?? 0} SKUs · reserved units are held against open orders; available = physical − reserved.
      </p>

      {adjustTarget && (
        <AdjustDialog
          row={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onAdjusted={() => {
            setAdjustTarget(null);
            void load();
          }}
        />
      )}

      <HistorySheet row={historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)} />
    </div>
  );
}

// ---------- adjust dialog ----------

function AdjustDialog({ row, onClose, onAdjusted }: { row: InventoryRow; onClose: () => void; onAdjusted: () => void }) {
  const { toast } = useToast();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<(typeof MANUAL_REASONS)[number]>('PURCHASE_RECEIPT');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const n = Math.round(Number(delta));
    if (!Number.isFinite(n) || n === 0) {
      toast({ title: 'Enter a non-zero delta', description: 'Use negative numbers for write-offs.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ currentStock: number }>('/api/admin/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({ skuId: row.skuId, delta: n, reason, notes: notes.trim() || undefined }),
      });
      toast({ title: `Stock adjusted ${n > 0 ? '+' : ''}${n}`, description: `${row.skuCode} → ${res.currentStock} on hand` });
      onAdjusted();
    } catch (err) {
      toast({ title: 'Adjustment rejected', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Adjust stock — {row.skuCode}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {row.productName} · {row.variantName} · {row.currentStock} on hand, {row.reservedStock} reserved
          </p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="adj-delta">Delta (± units)</Label>
            <Input id="adj-delta" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. 10 or -2" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Reason (mandatory, audited)</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as (typeof MANUAL_REASONS)[number])}>
              <SelectTrigger aria-label="Movement reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-notes">Notes</Label>
            <Textarea id="adj-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={300} placeholder="Reference (GRN, invoice, damage report)…" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Every adjustment writes an immutable inventory_movement row (ADR-008 audit ledger). Physical stock cannot drop below reserved units.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Apply adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- history sheet ----------

function HistorySheet({ row, onOpenChange }: { row: InventoryRow | null; onOpenChange: (open: boolean) => void }) {
  // Data keyed by skuId — loading & reset are DERIVED (no synchronous setState in the effect).
  const [data, setData] = useState<{ skuId: string; movements: MovementRow[] } | null>(null);

  useEffect(() => {
    if (!row) return;
    const skuId = row.skuId;
    let cancelled = false;
    api<{ movements: MovementRow[] }>(`/api/admin/inventory/history?skuId=${encodeURIComponent(skuId)}`)
      .then((res) => {
        if (!cancelled) setData({ skuId, movements: res.movements });
      })
      .catch(() => {
        if (!cancelled) setData({ skuId, movements: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [row]);

  const movements = row && data && data.skuId === row.skuId ? data.movements : null;
  const loading = row !== null && movements === null;

  return (
    <Sheet open={row !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto thin-scrollbar">
        <SheetHeader className="p-0 pb-4">
          <SheetTitle className="font-display text-lg">Movement ledger</SheetTitle>
          {row && (
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{row.skuCode}</span> · {row.productName} · {row.variantName}
            </p>
          )}
        </SheetHeader>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : movements && movements.length > 0 ? (
          <ul className="space-y-2">
            {movements.map((m) => (
              <li key={m.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <MovementReasonBadge reason={m.reason} />
                  <span className={cn('font-display text-sm tabular-nums', m.quantity > 0 ? 'text-primary' : 'text-destructive')}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{formatDate(m.createdAt, true)}</p>
                {m.notes && <p className="mt-0.5 text-xs">{m.notes}</p>}
                {m.referenceId && <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">ref: {m.referenceId}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No movements recorded for this SKU yet.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
