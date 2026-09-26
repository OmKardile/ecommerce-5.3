'use client';

// ReturnsQueue — RMA pipeline console. Status filter tabs, order context,
// serial visibility, and the four FSM actions (approve / reject / restock /
// refund) with confirmation dialogs.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, PackageOpen, RotateCcw, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/money';
import { api, formatDate } from '@/components/admin/api';

interface ReturnRow {
  id: string;
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'RESTOCKED' | 'REFUNDED';
  refundAmount: number;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    paymentMethod: string;
    deliveryName: string;
    deliveryPhone: string;
    user: { phone: string | null; fullName: string | null } | null;
    items: { id: string; productName: string; variantName: string; skuCode: string; quantity: number; serialNumbers: string }[];
  };
}

type Filter = 'ALL' | 'REQUESTED' | 'APPROVED' | 'RESTOCKED' | 'REFUNDED' | 'REJECTED';

const ACTION_LABELS: Record<string, string> = {
  APPROVE: 'Approve & schedule pickup',
  REJECT: 'Reject request',
  MARK_RESTOCKED: 'Unit received — restock',
  MARK_REFUNDED: 'Refund processed',
};

const STATUS_BADGE: Record<string, string> = {
  REQUESTED: 'border-amber-600/40 text-amber-700',
  APPROVED: 'border-sky-700/40 text-sky-800',
  RESTOCKED: 'border-primary/40 text-primary',
  REFUNDED: 'border-foreground/30 text-foreground',
  REJECTED: 'border-destructive/40 text-destructive',
};

function parseSerials(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function nextActions(status: ReturnRow['status']): { action: string; label: string; variant: 'default' | 'outline' | 'destructive' }[] {
  switch (status) {
    case 'REQUESTED':
      return [
        { action: 'APPROVE', label: 'Approve', variant: 'default' },
        { action: 'REJECT', label: 'Reject', variant: 'outline' },
      ];
    case 'APPROVED':
      return [
        { action: 'MARK_RESTOCKED', label: 'Unit received — restock', variant: 'default' },
        { action: 'REJECT', label: 'Reject', variant: 'outline' },
      ];
    case 'RESTOCKED':
      return [{ action: 'MARK_REFUNDED', label: 'Refund processed', variant: 'default' }];
    default:
      return [];
  }
}

export function ReturnsQueue() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [rows, setRows] = useState<ReturnRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ row: ReturnRow; action: string; label: string; variant: 'default' | 'outline' | 'destructive' } | null>(null);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const data = await api<{ returns: ReturnRow[] }>(`/api/admin/returns?status=${f}`);
      setRows(data.returns);
    } catch {
      toast({ title: 'Could not load the returns queue', variant: 'destructive' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function runAction(row: ReturnRow, action: string) {
    setBusyId(row.id);
    try {
      await api(`/api/admin/returns?id=${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      toast({ title: ACTION_LABELS[action] ?? action, description: `${row.order.orderNumber} updated — the customer has been notified.` });
      setConfirming(null);
      await load(filter);
    } catch (err) {
      toast({ title: 'Action failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="h-9">
          {(['ALL', 'REQUESTED', 'APPROVED', 'RESTOCKED', 'REFUNDED', 'REJECTED'] as Filter[]).map((f) => (
            <TabsTrigger key={f} value={f} className="text-xs">
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="max-w-72">Issue</TableHead>
              <TableHead className="w-28">Refund</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-56 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            )}
            {!loading && rows && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-14 text-center">
                  <p className="font-display text-lg">Queue clear</p>
                  <p className="mt-1 text-xs text-muted-foreground">No return requests in this state. DOA claims from the 7-day window land here.</p>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              rows &&
              rows.map((row) => {
                const serials = row.order.items.flatMap((i) => parseSerials(i.serialNumbers));
                const actions = nextActions(row.status);
                const phone = row.order.user?.phone ?? row.order.deliveryPhone;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href="/admin/orders" className="font-medium hover:underline">
                        {row.order.orderNumber}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(row.createdAt)}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.order.paymentMethod === 'COD' ? 'COD' : 'Prepaid'} · {row.order.items.length} item(s)
                        {serials.length > 0 && <span className="font-mono"> · {serials.length} serial(s)</span>}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{row.order.user?.fullName ?? row.order.deliveryName}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">{phone}</p>
                    </TableCell>
                    <TableCell className="max-w-72">
                      <p className="line-clamp-2 text-sm text-foreground/90" title={row.reason}>{row.reason}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.order.items.map((i) => `${i.skuCode} × ${i.quantity}`).join(', ')}
                      </p>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">{formatINR(row.order.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[row.status]}>
                        {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                      </Badge>
                      <p className="mt-1 text-[11px] text-muted-foreground">Order: {row.order.status.replace(/_/g, ' ').toLowerCase()}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {actions.map((a) => (
                          <Button
                            key={a.action}
                            size="sm"
                            variant={a.variant}
                            className="h-8"
                            disabled={busyId === row.id}
                            onClick={() => setConfirming({ row, action: a.action, label: ACTION_LABELS[a.action] ?? a.action, variant: a.variant })}
                          >
                            {a.action === 'APPROVE' && <Check className="h-3.5 w-3.5" aria-hidden />}
                            {a.action === 'REJECT' && <X className="h-3.5 w-3.5" aria-hidden />}
                            {a.action === 'MARK_RESTOCKED' && <PackageOpen className="h-3.5 w-3.5" aria-hidden />}
                            {a.action === 'MARK_REFUNDED' && <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{confirming?.label}</DialogTitle>
            <DialogDescription>
              {confirming?.action === 'APPROVE' &&
                `Approve the return for ${confirming?.row.order.orderNumber}? The customer is told pickup will be scheduled; the next step after receipt is restock.`}
              {confirming?.action === 'REJECT' &&
                `Reject this request? The order is reinstated (back to processing) and the desk follows up with the customer by phone.`}
              {confirming?.action === 'MARK_RESTOCKED' &&
                `Confirms the physical unit is back at the Surat hub. Stock is incremented per the original invoice lines (RETURN_RESTOCK) and the order moves to Returned.`}
              {confirming?.action === 'MARK_REFUNDED' &&
                `Marks the refund as processed for ${confirming ? formatINR(confirming.row.order.totalAmount) : ''}. Payments flip to REFUNDED and the order closes as Refunded. Verify the bank transfer first.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)} disabled={busyId !== null}>
              Cancel
            </Button>
            <Button
              variant={confirming?.action === 'REJECT' ? 'destructive' : 'default'}
              disabled={busyId !== null}
              onClick={() => confirming && runAction(confirming.row, confirming.action)}
              className="min-w-36"
            >
              {busyId ? 'Working…' : confirming?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
