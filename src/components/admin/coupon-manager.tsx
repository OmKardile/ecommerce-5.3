'use client';

// Coupon manager — create/edit dialog with type-aware value input
// (PERCENT = 1-100 %, FIXED = rupees → paise), active switch, delete guard.

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { api, formatDate } from '@/components/admin/api';
import { formatINR } from '@/lib/money';

interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minOrderValue: number | null;
  maxDiscountValue: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}

interface Draft {
  id?: string;
  code: string;
  description: string;
  type: 'PERCENT' | 'FIXED';
  value: string;
  minOrderRupees: string;
  maxDiscountRupees: string;
  endsAtLocal: string;
  usageLimit: string;
  isActive: boolean;
}

const EMPTY: Draft = { code: '', description: '', type: 'PERCENT', value: '', minOrderRupees: '', maxDiscountRupees: '', endsAtLocal: '', usageLimit: '', isActive: true };

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CouponManager() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CouponRow[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ coupons: CouponRow[] }>('/api/admin/coupons');
      setRows(res.coupons);
    } catch (err) {
      toast({ title: 'Failed to load coupons', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
      setRows([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(r: CouponRow) {
    setDraft({
      id: r.id,
      code: r.code,
      description: r.description ?? '',
      type: r.type,
      value: r.type === 'PERCENT' ? String(r.value) : String(r.value / 100),
      minOrderRupees: r.minOrderValue ? String(r.minOrderValue / 100) : '',
      maxDiscountRupees: r.maxDiscountValue ? String(r.maxDiscountValue / 100) : '',
      endsAtLocal: toLocalInputValue(r.endsAt),
      usageLimit: r.usageLimit ? String(r.usageLimit) : '',
      isActive: r.isActive,
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    const rawValue = Number(draft.value);
    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      toast({ title: 'Invalid value', description: draft.type === 'PERCENT' ? 'Percent must be 1-100.' : 'Amount must be greater than zero.', variant: 'destructive' });
      return;
    }
    if (draft.type === 'PERCENT' && rawValue > 100) {
      toast({ title: 'Invalid percent', description: 'PERCENT coupons take 1-100.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const payload = {
      code: draft.code.trim().toUpperCase(),
      description: draft.description.trim(),
      type: draft.type,
      value: draft.type === 'PERCENT' ? Math.round(rawValue) : Math.round(rawValue * 100),
      minOrderValue: draft.minOrderRupees ? Math.round(Number(draft.minOrderRupees) * 100) : null,
      maxDiscountValue: draft.maxDiscountRupees ? Math.round(Number(draft.maxDiscountRupees) * 100) : null,
      endsAt: draft.endsAtLocal ? new Date(draft.endsAtLocal).toISOString() : null,
      usageLimit: draft.usageLimit ? Math.round(Number(draft.usageLimit)) : null,
      isActive: draft.isActive,
    };
    try {
      if (draft.id) {
        await api(`/api/admin/coupons/${draft.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast({ title: 'Coupon updated', description: payload.code });
      } else {
        await api('/api/admin/coupons', { method: 'POST', body: JSON.stringify(payload) });
        toast({ title: 'Coupon created', description: payload.code });
      }
      setDraft(null);
      await load();
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(r: CouponRow, next: boolean) {
    setRows((prev) => (prev ? prev.map((c) => (c.id === r.id ? { ...c, isActive: next } : c)) : prev));
    try {
      await api(`/api/admin/coupons/${r.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: next }) });
    } catch (err) {
      setRows((prev) => (prev ? prev.map((c) => (c.id === r.id ? { ...c, isActive: !next } : c)) : prev));
      toast({ title: 'Toggle failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }

  async function remove(r: CouponRow) {
    if (!window.confirm(`Delete coupon ${r.code}?`)) return;
    try {
      const res = await api<{ deleted?: boolean; deactivated?: boolean }>(`/api/admin/coupons/${r.id}`, { method: 'DELETE' });
      toast({ title: res.deactivated ? 'Coupon deactivated' : 'Coupon deleted', description: res.deactivated ? 'Redemption history preserved.' : r.code });
      await load();
    } catch (err) {
      toast({ title: 'Delete failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="h-4 w-4" aria-hidden /> New coupon
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="max-h-[600px] overflow-auto thin-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Code</TableHead>
                <TableHead className="text-xs">Value</TableHead>
                <TableHead className="text-xs text-right">Min order</TableHead>
                <TableHead className="text-xs text-right">Max discount</TableHead>
                <TableHead className="text-xs text-center">Used / limit</TableHead>
                <TableHead className="text-xs">Valid until</TableHead>
                <TableHead className="text-xs text-center">Active</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows === null ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No coupons yet — create your first promotion.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className={!r.isActive ? 'opacity-60' : undefined}>
                    <TableCell>
                      <p className="font-mono text-xs font-semibold">{r.code}</p>
                      {r.description && <p className="text-[11px] text-muted-foreground max-w-[200px] truncate">{r.description}</p>}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.type === 'PERCENT' ? `${r.value}% off` : `${formatINR(r.value)} off`}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{r.minOrderValue ? formatINR(r.minOrderValue) : '—'}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{r.maxDiscountValue ? formatINR(r.maxDiscountValue) : '—'}</TableCell>
                    <TableCell className="text-center text-xs tabular-nums">
                      {r.usedCount}
                      {' / '}
                      {r.usageLimit ?? '∞'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{r.endsAt ? formatDate(r.endsAt) : 'No expiry'}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={r.isActive} onCheckedChange={(v) => void toggleActive(r, v)} aria-label={`Toggle ${r.code}`} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)} aria-label={`Edit ${r.code}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void remove(r)} aria-label={`Delete ${r.code}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          {draft && (
            <form onSubmit={save} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-display">{draft.id ? 'Edit coupon' : 'New coupon'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cp-code">Code *</Label>
                  <Input id="cp-code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="DIWALI10" className="font-mono" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as 'PERCENT' | 'FIXED', value: '' })}>
                    <SelectTrigger aria-label="Coupon type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">Percent (1-100%)</SelectItem>
                      <SelectItem value="FIXED">Fixed amount (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-value">{draft.type === 'PERCENT' ? 'Percent off * (1-100)' : 'Amount off ₹ *'}</Label>
                  <Input id="cp-value" type="number" min={0} step={draft.type === 'PERCENT' ? 1 : 0.01} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} required />
                  <p className="text-[10px] text-muted-foreground">{draft.type === 'PERCENT' ? 'Stored as whole percent.' : 'Entered in rupees, stored as paise.'}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-min">Min order (₹)</Label>
                  <Input id="cp-min" type="number" min={0} value={draft.minOrderRupees} onChange={(e) => setDraft({ ...draft, minOrderRupees: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-max">Max discount (₹)</Label>
                  <Input id="cp-max" type="number" min={0} value={draft.maxDiscountRupees} onChange={(e) => setDraft({ ...draft, maxDiscountRupees: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-limit">Usage limit</Label>
                  <Input id="cp-limit" type="number" min={1} value={draft.usageLimit} onChange={(e) => setDraft({ ...draft, usageLimit: e.target.value })} placeholder="∞" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-ends">Ends at</Label>
                  <Input id="cp-ends" type="datetime-local" value={draft.endsAtLocal} onChange={(e) => setDraft({ ...draft, endsAtLocal: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cp-desc">Description</Label>
                  <Input id="cp-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={200} />
                </div>
                <div className="flex items-center justify-between sm:col-span-2">
                  <Label htmlFor="cp-active">Active</Label>
                  <Switch id="cp-active" checked={draft.isActive} onCheckedChange={(v) => setDraft({ ...draft, isActive: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {draft.id ? 'Save changes' : 'Create coupon'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
