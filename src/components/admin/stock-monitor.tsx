'use client';

// StockMonitor — ADR-010 observe-and-report console for counter/floor staff.
// Wall: glanceable per-SKU availability (state-coloured, auto-refresh, kiosk mode).
// SKU dialog: human-phrased movement history + discrepancy reporting (never mutates
// stock — proposals go to the manager queue in the Inventory console).
// Count: cycle-count sessions with expected snapshots and bulk submit.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  History,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api, formatDate } from '@/components/admin/api';
import { DISCREPANCY_REASONS } from '@/lib/validators';

// ---------- types (mirrors service projections) ----------

type WallState = 'OK' | 'LOW' | 'OUT';

interface WallSku {
  skuId: string;
  code: string;
  barcode: string | null;
  available: number;
  currentStock: number;
  reservedStock: number;
  lowStockThreshold: number;
  state: WallState;
}

interface WallTile {
  productId: string;
  name: string;
  slug: string;
  modelNumber: string | null;
  brandName: string;
  categoryName: string;
  image: string | null;
  skus: WallSku[];
  worst: WallState;
}

interface WallData {
  tiles: WallTile[];
  totals: { ok: number; low: number; out: number; skus: number };
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
}

interface HistoryData {
  sku: { id: string; code: string; currentStock: number; reservedStock: number };
  movements: { id: string; quantity: number; reason: string; referenceId: string | null; notes: string | null; createdAt: string; phrase: string }[];
}

interface SessionSummary {
  id: string;
  title: string;
  status: string;
  scopeKind: string;
  openedBy: string;
  createdAt: string;
  closedAt: string | null;
  totalLines: number;
  countedLines: number;
  varianceLines: number;
  unappliedVariances: number;
}

interface SessionDetail {
  id: string;
  title: string;
  status: string;
  scopeKind: string;
  openedBy: string;
  createdAt: string;
  lines: { id: string; skuCode: string; productName: string; variantName: string | null; expectedQty: number; countedQty: number | null; variance: number | null; note: string | null; appliedAt: string | null }[];
}

// ---------- shared bits ----------

const STATE_CHIP: Record<WallState, string> = {
  OK: 'bg-[#e7ede9] text-[#1a3c34] dark:bg-[#1a3c34]/70 dark:text-[#7fc4ab]',
  LOW: 'bg-[#f4ead8] text-[#7a5a1d] dark:bg-[#7a5a1d]/40 dark:text-[#d19a4a]',
  OUT: 'bg-destructive/10 text-destructive dark:bg-destructive/25 dark:text-red-300',
};

const REASON_DEFAULT_DELTA: Record<string, number | null> = {
  DAMAGED: -1,
  MISSING: -1,
  FOUND: 1,
  WRONG_LOCATION: 0,
  OTHER: null,
};

const REASON_HINT: Record<string, string> = {
  DAMAGED: 'Units damaged on shelf — delta is negative.',
  MISSING: 'Units unaccounted for — delta is negative.',
  FOUND: 'Units found unlisted — delta is positive.',
  WRONG_LOCATION: 'Flag report only — no stock change; a note helps the manager.',
  OTHER: 'Signed correction with a free delta.',
};

function StateChip({ state }: { state: WallState }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border border-transparent', STATE_CHIP[state])}>
      {state === 'OK' ? 'In stock' : state === 'LOW' ? 'Low' : 'Out'}
    </span>
  );
}

// ---------- stock monitor root ----------

export function StockMonitor({ role = '' }: { role?: string }) {
  const [tab, setTab] = useState('wall');

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full min-w-0">
      <TabsList className="w-fit">
        <TabsTrigger value="wall">Stock wall</TabsTrigger>
        <TabsTrigger value="count">Count sessions</TabsTrigger>
      </TabsList>
      <TabsContent value="wall" className="mt-4 min-w-0">
        <StockWall />
      </TabsContent>
      <TabsContent value="count" className="mt-4 min-w-0">
        <CountSessions isStaff={role === 'STAFF'} />
      </TabsContent>
    </Tabs>
  );
}

// ---------- stock wall ----------

function StockWall() {
  const { toast } = useToast();
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('ALL');
  const [brandId, setBrandId] = useState('ALL');
  const [data, setData] = useState<WallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [kiosk, setKiosk] = useState(false);
  const [dialogTile, setDialogTile] = useState<WallTile | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(
    async (silent = false) => {
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (categoryId !== 'ALL') params.set('categoryId', categoryId);
        if (brandId !== 'ALL') params.set('brandId', brandId);
        const result = await api<WallData>(`/api/admin/stock-monitor/wall?${params.toString()}`);
        if (requestId.current === id) {
          setData(result);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (requestId.current === id && !silent) {
          toast({ title: 'Could not load stock wall', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
        }
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    },
    [q, categoryId, brandId, toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(true), 60_000); // wall refreshes itself every minute
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!kiosk) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKiosk(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kiosk]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const byCategory = new Map<string, WallTile[]>();
    for (const tile of data.tiles) {
      const list = byCategory.get(tile.categoryName) ?? [];
      list.push(tile);
      byCategory.set(tile.categoryName, list);
    }
    return [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, tiles]) => ({
        category,
        tiles: tiles.sort((a, b) => a.brandName.localeCompare(b.brandName) || a.name.localeCompare(b.name)),
      }));
  }, [data]);

  const totals = data?.totals ?? { ok: 0, low: 0, out: 0, skus: 0 };

  const board = (kioskMode: boolean) => (
    <div className="min-w-0 space-y-6">
      {!kioskMode && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Name, model, SKU or barcode…" className="pl-9 h-9" aria-label="Search the stock wall" />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {data?.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by brand">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All brands</SelectItem>
              {data?.brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={() => load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              <span className="sr-only sm:not-sr-only sm:ml-1.5">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setKiosk(true)}>
              <Package className="h-4 w-4" aria-hidden />
              <span className="ml-1.5">Wall mode</span>
            </Button>
          </div>
        </div>
      )}

      {kioskMode && (
        <div className="flex items-center gap-3">
          <p className="font-display text-xl text-primary">Patel Networks — stock wall</p>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={() => load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              <span className="ml-1.5">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setKiosk(false)}>
              <X className="h-4 w-4" aria-hidden />
              <span className="ml-1.5">Exit wall mode</span>
            </Button>
          </div>
        </div>
      )}

      {/* totals strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm" aria-live="polite">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#1a3c34] dark:bg-[#7fc4ab]" aria-hidden />
          In stock <strong className="tabular-nums">{totals.ok}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#b98a2e] dark:bg-[#d19a4a]" aria-hidden />
          Low <strong className="tabular-nums">{totals.low}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden />
          Out <strong className="tabular-nums">{totals.out}</strong>
        </span>
        <span className="text-muted-foreground text-xs">
          {totals.skus} SKUs{lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}
        </span>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[120px] rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 text-sm font-medium">Nothing matches this filter</p>
          <p className="mt-1 text-xs text-muted-foreground">Clear the search or pick another category/brand.</p>
        </div>
      ) : (
        grouped.map(({ category, tiles }) => (
          <section key={category} aria-label={category} className="min-w-0">
            <p className="label-caps mb-2">{category}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tiles.map((tile) => (
                <TileCard key={tile.productId} tile={tile} onOpen={() => setDialogTile(tile)} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );

  if (kiosk) {
    return (
      <>
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-background p-4 sm:p-6">{board(true)}</div>
        {dialogTile && <TileDialog tile={dialogTile} onClose={() => setDialogTile(null)} />}
      </>
    );
  }
  return (
    <>
      {board(false)}
      {dialogTile && <TileDialog tile={dialogTile} onClose={() => setDialogTile(null)} />}
    </>
  );

  function TileCard({ tile, onOpen }: { tile: WallTile; onOpen: () => void }) {
    const multi = tile.skus.length > 1;
    return (
      <button
        type="button"
        onClick={onOpen}
        className="press group flex w-full min-w-0 items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
      >
        {tile.image ? (
          <img src={tile.image} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover" loading="lazy" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <Package className="h-5 w-5 text-muted-foreground/60" aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{tile.name}</span>
            <span className="ml-auto shrink-0"><StateChip state={tile.worst} /></span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {tile.brandName}
            {tile.modelNumber ? ` · ${tile.modelNumber}` : ''}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {tile.skus.map((s) => (
              <span
                key={s.skuId}
                className={cn('inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-[11px] tabular-nums', STATE_CHIP[s.state])}
              >
                <span className="font-mono text-[10px] opacity-75">{multi ? s.code : ''}</span>
                <span className="font-semibold">{s.available}</span>
                <span className="opacity-70">avail.</span>
              </span>
            ))}
          </span>
        </span>
      </button>
    );
  }
}

// ---------- SKU dialog (history + discrepancy report) ----------

function TileDialog({ tile, onClose }: { tile: WallTile; onClose: () => void }) {
  const [skuIdx, setSkuIdx] = useState(0);
  const sku = tile.skus[Math.min(skuIdx, tile.skus.length - 1)];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto thin-scrollbar sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-left">{tile.name}</DialogTitle>
          <DialogDescription className="sr-only">Per-SKU availability, recent movements and discrepancy reporting</DialogDescription>
        </DialogHeader>

        {tile.skus.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Select SKU">
            {tile.skus.map((s, i) => (
              <button
                key={s.skuId}
                type="button"
                role="tab"
                aria-selected={i === skuIdx}
                onClick={() => setSkuIdx(i)}
                className={cn(
                  'press rounded-md border px-2 py-1 font-mono text-[11px] tabular-nums',
                  i === skuIdx ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                {s.code}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-mono text-xs text-muted-foreground">{sku.code}</span>
            <StateChip state={sku.state} />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Available</p>
              <p className="font-display text-lg tabular-nums">{sku.available}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Physical</p>
              <p className="text-base tabular-nums">{sku.currentStock}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reserved</p>
              <p className="text-base tabular-nums">{sku.reservedStock}</p>
            </div>
          </div>
          {sku.barcode && <p className="mt-2 text-[11px] text-muted-foreground">Barcode {sku.barcode}</p>}
        </div>

        <SkuPanel key={sku.skuId} skuId={sku.skuId} skuCode={sku.code} />
      </DialogContent>
    </Dialog>
  );
}

// one SKU's ledger + report form; remounted per SKU (key) so the fetch effect
// runs once per selection with no synchronous state resets.
function SkuPanel({ skuId, skuCode }: { skuId: string; skuCode: string }) {
  const { toast } = useToast();
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api<HistoryData>(`/api/admin/stock-monitor/history?skuId=${skuId}`)
      .then((h) => alive && setHistory(h))
      .catch(() => alive && toast({ title: 'Could not load movement history', variant: 'destructive' }))
      .finally(() => alive && setHistoryLoading(false));
    return () => {
      alive = false;
    };
  }, [skuId, toast]);

  return (
    <>
      <DiscrepancyForm skuId={skuId} skuCode={skuCode} />

      <div className="min-w-0">
        <p className="label-caps mb-2 flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" aria-hidden /> Recent movements
        </p>
        {historyLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading ledger…
          </div>
        ) : history && history.movements.length > 0 ? (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto thin-scrollbar pr-1">
            {history.movements.map((m) => (
              <li key={m.id} className="flex items-baseline gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
                <span className={cn('tabular-nums font-semibold', m.quantity < 0 ? 'text-destructive' : 'text-[#1a3c34] dark:text-[#7fc4ab]')}>
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.phrase}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{formatDate(m.createdAt, true)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-xs text-muted-foreground">No movements recorded yet — this stock has not changed since intake.</p>
        )}
      </div>
    </>
  );
}

// discrepancy report — proposes; manager disposes (ADR-010)
function DiscrepancyForm({ skuId, skuCode }: { skuId: string; skuCode: string }) {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>('MISSING');
  const [delta, setDelta] = useState('-1');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function onReasonChange(next: string) {
    setReason(next);
    const def = REASON_DEFAULT_DELTA[next];
    setDelta(def === null ? '' : String(def));
  }

  async function submit() {
    const parsed = Number(delta);
    if (!Number.isInteger(parsed) || parsed === 0) {
      toast({ title: 'Enter a non-zero signed quantity', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await api('/api/admin/stock-monitor/adjustment-requests', {
        method: 'POST',
        body: JSON.stringify({ skuId, delta: parsed, reason, note: note.trim() || undefined }),
      });
      toast({ title: 'Report sent to the manager', description: `${skuCode}: ${reason === 'WRONG_LOCATION' ? 'location flag' : `${parsed > 0 ? '+' : ''}${parsed} (${reason.toLowerCase()})`}` });
      setNote('');
    } catch (err) {
      toast({ title: 'Could not submit report', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="label-caps mb-2">Report a discrepancy</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px]">
        <div>
          <Label htmlFor="disc-reason" className="sr-only">Reason</Label>
          <Select value={reason} onValueChange={onReasonChange}>
            <SelectTrigger id="disc-reason" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISCREPANCY_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {reason !== 'WRONG_LOCATION' && (
          <div>
            <Label htmlFor="disc-delta" className="sr-only">Quantity</Label>
            <Input id="disc-delta" type="number" inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} className="h-9 tabular-nums" aria-label="Signed quantity" />
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{REASON_HINT[reason]}</p>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} className="mt-2" placeholder="Note for the manager (shelf, batch, what you saw)…" aria-label="Note for the manager" />
      <Button size="sm" className="press mt-2 h-9 w-full sm:w-auto" onClick={submit} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        <span className="ml-1.5">Send to manager</span>
      </Button>
    </div>
  );
}

// ---------- count sessions ----------

function CountSessions({ isStaff }: { isStaff: boolean }) {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // open-session form
  const [title, setTitle] = useState('');
  const [scopeKind, setScopeKind] = useState<'CATEGORY' | 'BRAND' | 'ALL'>('CATEGORY');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [scopeRefId, setScopeRefId] = useState('');

  const { toast } = useToast();

  const loadSessions = useCallback(async () => {
    try {
      const result = await api<{ sessions: SessionSummary[] }>('/api/admin/stock-monitor/count-sessions');
      setSessions(result.sessions);
    } catch (err) {
      toast({ title: 'Could not load count sessions', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    loadSessions();
    api<{ categories: { id: string; name: string }[]; brands: { id: string; name: string }[] }>('/api/admin/stock-monitor/wall')
      .then((d) => {
        setCategories(d.categories);
        setBrands(d.brands);
      })
      .catch(() => undefined);
  }, [loadSessions]);

  const openDetail = useCallback(async (sessionId: string) => {
    setActiveId(sessionId);
    setCounts({});
    try {
      const d = await api<SessionDetail>(`/api/admin/stock-monitor/count-sessions/${sessionId}`);
      setDetail(d);
    } catch (err) {
      toast({ title: 'Could not open session', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }, [toast]);

  async function openSession() {
    if (title.trim().length < 3) {
      toast({ title: 'Give the session a title (3+ characters)', variant: 'destructive' });
      return;
    }
    if (scopeKind !== 'ALL' && !scopeRefId) {
      toast({ title: 'Pick a category or brand for the scope', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ sessionId: string }>('/api/admin/stock-monitor/count-sessions', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), scopeKind, ...(scopeKind !== 'ALL' ? { scopeRefId } : {}) }),
      });
      toast({ title: 'Count session opened', description: 'Enter what you actually find on the shelf.' });
      setTitle('');
      await loadSessions();
      await openDetail(result.sessionId);
    } catch (err) {
      toast({ title: 'Could not open session', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function submitCounts() {
    if (!detail) return;
    const lines = Object.entries(counts)
      .filter(([, v]) => v !== '')
      .map(([lineId, v]) => ({ lineId, countedQty: Number(v) }));
    if (lines.length === 0) {
      toast({ title: 'Enter at least one counted quantity', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ submitted: number; mismatches: number }>(`/api/admin/stock-monitor/count-sessions/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ lines }),
      });
      toast({
        title: 'Counts submitted',
        description:
          result.mismatches > 0
            ? `${result.mismatches} mismatch${result.mismatches > 1 ? 'es' : ''} flagged for the manager.`
            : 'Everything matches — no variance.',
      });
      setCounts({});
      await openDetail(detail.id);
      await loadSessions();
    } catch (err) {
      toast({ title: 'Could not submit counts', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const activeSessions = sessions?.filter((s) => s.status === 'OPEN' || s.status === 'COUNTING') ?? [];
  const pastSessions = sessions?.filter((s) => s.status !== 'OPEN' && s.status !== 'COUNTING') ?? [];
  const enteredCount = detail ? Object.values(counts).filter((v) => v !== '').length : 0;
  const progress = detail ? `${Math.max(detail.lines.filter((l) => l.countedQty !== null).length, enteredCount)}/${detail.lines.length}` : '';

  return (
    <div className="grid grid-cols-1 min-w-0 gap-6 lg:grid-cols-[340px_1fr]">
      {/* left rail: open form + sessions list */}
      <div className="min-w-0 space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="label-caps mb-2 flex items-center gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden /> Open a count session
          </p>
          <div className="space-y-2">
            <div>
              <Label htmlFor="cs-title" className="sr-only">Title</Label>
              <Input id="cs-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Monday shelf check — cameras" className="h-9" />
            </div>
            <Select value={scopeKind} onValueChange={(v) => { setScopeKind(v as typeof scopeKind); setScopeRefId(''); }}>
              <SelectTrigger className="h-9" aria-label="Scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CATEGORY">One category</SelectItem>
                <SelectItem value="BRAND">One brand</SelectItem>
                <SelectItem value="ALL">Everything (small shops only)</SelectItem>
              </SelectContent>
            </Select>
            {scopeKind === 'CATEGORY' && (
              <Select value={scopeRefId} onValueChange={setScopeRefId}>
                <SelectTrigger className="h-9" aria-label="Category scope">
                  <SelectValue placeholder="Pick category…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {scopeKind === 'BRAND' && (
              <Select value={scopeRefId} onValueChange={setScopeRefId}>
                <SelectTrigger className="h-9" aria-label="Brand scope">
                  <SelectValue placeholder="Pick brand…" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" className="press h-9 w-full" onClick={openSession} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              <span className="ml-1.5">Open session</span>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="label-caps mb-2">Active sessions</p>
          {activeSessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">None — open one to start counting.</p>
          ) : (
            <ul className="space-y-1.5">
              {activeSessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => openDetail(s.id)}
                    className={cn(
                      'press w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      activeId === s.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent/50',
                    )}
                  >
                    <span className="block truncate font-medium">{s.title}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                      {s.countedLines}/{s.totalLines} counted{s.unappliedVariances > 0 ? ` · ${s.unappliedVariances} variance` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pastSessions.length > 0 && (
            <>
              <p className="label-caps mb-2 mt-4">Past sessions</p>
              <ul className="max-h-48 space-y-1.5 overflow-y-auto thin-scrollbar pr-1">
                {pastSessions.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{s.title}</span>
                      <span className="text-[11px] text-muted-foreground">{formatDate(s.createdAt)}{s.varianceLines > 0 ? ` · ${s.varianceLines} variance` : ''}</span>
                    </span>
                    <StatusPill status={s.status} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* right: active count sheet */}
      <div className="min-w-0 rounded-xl border border-border bg-card">
        {!detail || (detail.status !== 'OPEN' && detail.status !== 'COUNTING') ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" aria-hidden />
            <p className="mt-3 text-sm font-medium">{detail ? `Session is ${detail.status.toLowerCase()}` : 'Pick or open a session'}</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {detail
                ? 'Submitted sheets go to the Inventory console where a manager reviews variances.'
                : 'Active sessions appear on the left. Count what is physically on the shelf — expected quantities are snapshotted at open.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
              <div className="min-w-0">
                <p className="truncate font-display text-base">{detail.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  Opened by {detail.openedBy} · {progress} counted
                </p>
              </div>
              <Button size="sm" className="press ml-auto h-9" onClick={submitCounts} disabled={busy || enteredCount === 0}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                <span className="ml-1.5">Submit {enteredCount > 0 ? enteredCount : ''}</span>
              </Button>
            </div>
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto thin-scrollbar">
              {detail.lines.map((line) => {
                const value = counts[line.id] ?? (line.countedQty !== null ? String(line.countedQty) : '');
                const mismatch = value !== '' && Number(value) !== line.expectedQty;
                return (
                  <li key={line.id} className="flex min-w-0 flex-wrap items-center gap-2 px-4 py-2.5 sm:flex-nowrap">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        <span className="font-mono text-[11px] text-muted-foreground">{line.skuCode}</span>{' '}
                        {line.productName}
                        {line.variantName ? <span className="text-muted-foreground"> — {line.variantName}</span> : null}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        expected {line.expectedQty}
                        {line.appliedAt ? ' · applied by manager' : line.variance !== null && line.variance !== 0 ? ` · variance ${line.variance > 0 ? '+' : ''}${line.variance}` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="press h-8 w-8"
                        aria-label={`Decrease counted quantity for ${line.skuCode}`}
                        onClick={() => setCounts((c) => ({ ...c, [line.id]: String(Math.max(0, Number(value || '0') - 1)) }))}
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Input
                        value={value}
                        onChange={(e) => setCounts((c) => ({ ...c, [line.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                        inputMode="numeric"
                        className={cn('h-8 w-16 text-center tabular-nums', mismatch && 'border-[#b98a2e] dark:border-[#d19a4a]')}
                        aria-label={`Counted quantity for ${line.skuCode} (expected ${line.expectedQty})`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="press h-8 w-8"
                        aria-label={`Increase counted quantity for ${line.skuCode}`}
                        onClick={() => setCounts((c) => ({ ...c, [line.id]: String(Number(value || '0') + 1) }))}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
            {isStaff && (
              <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                You count and report — a manager applies corrections from the Inventory console. Nothing changes stock directly from this sheet.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUBMITTED: 'bg-[#f4ead8] text-[#7a5a1d] dark:bg-[#7a5a1d]/40 dark:text-[#d19a4a]',
    CLOSED: 'bg-muted text-muted-foreground',
    CANCELLED: 'bg-destructive/10 text-destructive dark:bg-destructive/25 dark:text-red-300',
    OPEN: 'bg-[#e7ede9] text-[#1a3c34] dark:bg-[#1a3c34]/70 dark:text-[#7fc4ab]',
    COUNTING: 'bg-[#e7ede9] text-[#1a3c34] dark:bg-[#1a3c34]/70 dark:text-[#7fc4ab]',
  };
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', map[status] ?? 'bg-muted text-muted-foreground')}>
      {status.toLowerCase()}
    </span>
  );
}
