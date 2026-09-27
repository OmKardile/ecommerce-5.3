'use client';

// StockRequestsConsole — the manager side of the stock monitor (ADR-010):
// pending discrepancy requests to approve/reject, and submitted count sessions
// whose variances can be applied (one click → real MANUAL_ADJUSTMENT movement).

import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardCheck, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api, formatDate } from '@/components/admin/api';

interface RequestRow {
  id: string;
  skuId: string;
  skuCode: string;
  productName: string;
  variantName: string | null;
  delta: number;
  reason: string;
  note: string | null;
  status: string;
  createdAt: string;
  decidedAt: string | null;
}

interface SessionRow {
  id: string;
  title: string;
  status: string;
  openedBy: string;
  createdAt: string;
  totalLines: number;
  countedLines: number;
  varianceLines: number;
  unappliedVariances: number;
}

interface SessionLine {
  id: string;
  skuCode: string;
  productName: string;
  variantName: string | null;
  expectedQty: number;
  countedQty: number | null;
  variance: number | null;
  note: string | null;
  appliedAt: string | null;
}

interface SessionDetail {
  id: string;
  title: string;
  status: string;
  openedBy: string;
  createdAt: string;
  lines: SessionLine[];
}

const REASON_CHIP: Record<string, string> = {
  DAMAGED: 'bg-destructive/10 text-destructive dark:bg-destructive/25 dark:text-red-300',
  MISSING: 'bg-destructive/10 text-destructive dark:bg-destructive/25 dark:text-red-300',
  FOUND: 'bg-[#e7ede9] text-[#1a3c34] dark:bg-[#1a3c34]/70 dark:text-[#7fc4ab]',
  WRONG_LOCATION: 'bg-[#f4ead8] text-[#7a5a1d] dark:bg-[#7a5a1d]/40 dark:text-[#d19a4a]',
  OTHER: 'bg-muted text-muted-foreground',
};

export function StockRequestsConsole() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'requests' | 'counts'>('requests');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [req, cnt] = await Promise.all([
        api<{ requests: RequestRow[] }>(`/api/admin/stock-monitor/adjustment-requests?status=${statusFilter}`),
        api<{ sessions: SessionRow[] }>('/api/admin/stock-monitor/count-sessions'),
      ]);
      setRequests(req.requests);
      setSessions(cnt.sessions);
    } catch (err) {
      toast({ title: 'Could not load stock requests', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openSession = useCallback(
    async (id: string) => {
      setOpenSessionId(id);
      setSessionDetail(null);
      try {
        const d = await api<SessionDetail>(`/api/admin/stock-monitor/count-sessions/${id}`);
        setSessionDetail(d);
      } catch (err) {
        toast({ title: 'Could not open count session', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
      }
    },
    [toast],
  );

  async function decide(requestId: string, decision: 'APPROVED' | 'REJECTED') {
    setBusyId(requestId);
    try {
      await api(`/api/admin/stock-monitor/adjustment-requests/${requestId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      toast({
        title: decision === 'APPROVED' ? 'Request approved — stock adjusted' : 'Request rejected',
        description: decision === 'APPROVED' ? 'The movement is recorded in the inventory ledger.' : undefined,
      });
      await load();
    } catch (err) {
      toast({ title: 'Decision failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  async function applyLine(lineId: string) {
    setBusyId(lineId);
    try {
      await api('/api/admin/stock-monitor/count-lines/apply', { method: 'POST', body: JSON.stringify({ lineId }) });
      toast({ title: 'Variance applied — stock adjusted' });
      if (openSessionId) await openSession(openSessionId);
      await load();
    } catch (err) {
      toast({ title: 'Could not apply variance', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  async function closeSession(id: string) {
    setBusyId(id);
    try {
      await api(`/api/admin/stock-monitor/count-sessions/${id}/close`, { method: 'POST' });
      toast({ title: 'Session closed' });
      await load();
    } catch (err) {
      toast({ title: 'Could not close session', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = statusFilter === 'PENDING' ? (requests?.length ?? 0) : null;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5" role="tablist" aria-label="Request queues">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'requests'}
            onClick={() => setTab('requests')}
            className={cn('press rounded-md px-3 py-1.5 text-sm', tab === 'requests' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground')}
          >
            Discrepancy requests{pendingCount !== null && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'counts'}
            onClick={() => setTab('counts')}
            className={cn('press rounded-md px-3 py-1.5 text-sm', tab === 'counts' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground')}
          >
            Count sessions
          </button>
        </div>
        {tab === 'requests' && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Request status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" className="ml-auto h-9" onClick={load}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only sm:ml-1.5">Refresh</span>
        </Button>
      </div>

      {tab === 'requests' && (
        <div className="min-w-0">
          {requests === null ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading queue…
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <Check className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden />
              <p className="mt-3 text-sm font-medium">{statusFilter === 'PENDING' ? 'Queue is clear' : 'No requests here'}</p>
              <p className="mt-1 text-xs text-muted-foreground">Staff reports from the Stock Monitor land in this queue.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {requests.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', REASON_CHIP[r.reason] ?? 'bg-muted text-muted-foreground')}>
                      {r.reason.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">{r.skuCode}</span>
                    <span className="min-w-0 truncate text-sm font-medium">{r.productName}{r.variantName ? ` — ${r.variantName}` : ''}</span>
                    {r.delta !== 0 && (
                      <span className={cn('ml-auto shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums', r.delta < 0 ? 'text-destructive' : 'text-[#1a3c34] dark:text-[#7fc4ab]')}>
                        {r.delta > 0 ? '+' : ''}
                        {r.delta}
                      </span>
                    )}
                    {r.status !== 'PENDING' && (
                      <span className="ml-auto shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {r.status} · {formatDate(r.decidedAt)}
                      </span>
                    )}
                  </div>
                  {r.note && <p className="mt-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">“{r.note}”</p>}
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Reported {formatDate(r.createdAt, true)}</p>
                  {r.status === 'PENDING' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button size="sm" className="press h-9" onClick={() => decide(r.id, 'APPROVED')} disabled={busyId === r.id}>
                        {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                        <span className="ml-1.5">{r.delta === 0 ? 'Acknowledge' : 'Approve & adjust'}</span>
                      </Button>
                      <Button size="sm" variant="outline" className="press h-9" onClick={() => decide(r.id, 'REJECTED')} disabled={busyId === r.id}>
                        <X className="h-4 w-4" aria-hidden />
                        <span className="ml-1.5">Reject</span>
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'counts' && (
        <div className="grid grid-cols-1 min-w-0 gap-4 lg:grid-cols-[300px_1fr]">
          <div className="min-w-0 rounded-xl border border-border bg-card p-4">
            <p className="label-caps mb-2 flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden /> Sessions
            </p>
            {sessions === null ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No count sessions yet.</p>
            ) : (
              <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto thin-scrollbar pr-1">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => openSession(s.id)}
                      className={cn(
                        'press w-full rounded-lg border px-3 py-2 text-left transition-colors',
                        openSessionId === s.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent/50',
                      )}
                    >
                      <span className="block truncate text-sm font-medium">{s.title}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                        {s.status.toLowerCase()} · {s.countedLines}/{s.totalLines} counted
                        {s.unappliedVariances > 0 ? ` · ${s.unappliedVariances} to apply` : ''}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{formatDate(s.createdAt)} · by {s.openedBy}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {openSessionId && sessionDetail && ['OPEN', 'COUNTING', 'SUBMITTED'].includes(sessionDetail.status) && (
              <Button variant="outline" size="sm" className="press mt-3 h-9 w-full" onClick={() => closeSession(openSessionId)} disabled={busyId === openSessionId}>
                Close session
              </Button>
            )}
          </div>

          <div className="min-w-0 rounded-xl border border-border bg-card">
            {!sessionDetail ? (
              <div className="flex h-full min-h-[240px] items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Select a session to review its variances.
              </div>
            ) : (
              <>
                <div className="border-b border-border p-4">
                  <p className="font-display text-base">{sessionDetail.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {sessionDetail.status.toLowerCase()} · opened by {sessionDetail.openedBy} · {formatDate(sessionDetail.createdAt)}
                  </p>
                </div>
                {sessionDetail.lines.every((l) => l.variance === null || l.variance === 0) ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No variances in this session — counts match expected stock.</p>
                ) : (
                  <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto thin-scrollbar">
                    {sessionDetail.lines
                      .filter((l) => l.variance !== null && l.variance !== 0)
                      .map((l) => (
                        <li key={l.id} className="flex min-w-0 flex-wrap items-center gap-2 px-4 py-3">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              <span className="font-mono text-[11px] text-muted-foreground">{l.skuCode}</span> {l.productName}
                              {l.variantName ? <span className="text-muted-foreground"> — {l.variantName}</span> : null}
                            </span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              expected {l.expectedQty} · counted {l.countedQty ?? '—'} ·{' '}
                              <span className={cn('font-semibold', (l.variance ?? 0) < 0 ? 'text-destructive' : 'text-[#1a3c34] dark:text-[#7fc4ab]')}>
                                variance {(l.variance ?? 0) > 0 ? '+' : ''}
                                {l.variance}
                              </span>
                            </span>
                            {l.note && <span className="mt-0.5 block text-[11px] italic text-muted-foreground">“{l.note}”</span>}
                          </span>
                          {l.appliedAt ? (
                            <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">applied {formatDate(l.appliedAt)}</span>
                          ) : (
                            <Button size="sm" className="press h-8 shrink-0" onClick={() => applyLine(l.id)} disabled={busyId === l.id}>
                              {busyId === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
                              <span className="ml-1.5">Apply</span>
                            </Button>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
