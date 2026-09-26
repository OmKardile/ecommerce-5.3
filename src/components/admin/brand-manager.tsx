'use client';

// Brand manager — table + create/edit dialog + delete guard.

import { useState, type FormEvent } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { api } from '@/components/admin/api';

export interface AdminBrandRow {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  isActive: boolean;
  productCount: number;
}

interface Draft {
  id?: string;
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
  isActive: boolean;
}

const EMPTY: Draft = { name: '', slug: '', logoUrl: '', description: '', isActive: true };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function BrandManager({ brands }: { brands: AdminBrandRow[] }) {
  const { toast } = useToast();
  const [rows, setRows] = useState(brands);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    const payload = {
      name: draft.name.trim(),
      slug: draft.slug.trim() || undefined,
      logoUrl: draft.logoUrl.trim(),
      description: draft.description.trim(),
      isActive: draft.isActive,
    };
    try {
      if (draft.id) {
        const { brand } = await api<{ brand: AdminBrandRow }>(`/api/admin/brands/${draft.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setRows((prev) => prev.map((r) => (r.id === draft.id ? { ...r, ...brand, productCount: r.productCount } : r)));
        toast({ title: 'Brand updated', description: brand.name });
      } else {
        const { brand } = await api<{ brand: AdminBrandRow }>('/api/admin/brands', { method: 'POST', body: JSON.stringify(payload) });
        setRows((prev) => [...prev, { ...brand, productCount: 0 }]);
        toast({ title: 'Brand created', description: brand.name });
      }
      setDraft(null);
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: AdminBrandRow, next: boolean) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: next } : r)));
    try {
      await api(`/api/admin/brands/${row.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: next }) });
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: !next } : r)));
      toast({ title: 'Toggle failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }

  async function remove(row: AdminBrandRow) {
    if (!window.confirm(`Delete brand “${row.name}”? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/brands/${row.id}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast({ title: 'Brand deleted', description: row.name });
    } catch (err) {
      toast({ title: 'Delete blocked', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="h-4 w-4" aria-hidden /> New brand
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="max-h-[600px] overflow-auto thin-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Brand</TableHead>
                <TableHead className="text-xs">Products</TableHead>
                <TableHead className="text-xs text-center">Live</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No brands yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className={!r.isActive ? 'opacity-60' : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {r.logoUrl ? (
                          <img src={r.logoUrl} alt="" className="h-8 w-8 rounded-md object-contain border border-border bg-white" />
                        ) : (
                          <div className="h-8 w-8 rounded-md bg-muted border border-border" aria-hidden />
                        )}
                        <div>
                          <p className="text-xs font-medium">{r.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">/{r.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{r.productCount}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={r.isActive} onCheckedChange={(v) => void toggleActive(r, v)} aria-label={`Toggle ${r.name}`} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setDraft({
                              id: r.id,
                              name: r.name,
                              slug: r.slug,
                              logoUrl: r.logoUrl ?? '',
                              description: r.description ?? '',
                              isActive: r.isActive,
                            })
                          }
                          aria-label={`Edit ${r.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void remove(r)} aria-label={`Delete ${r.name}`}>
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
                <DialogTitle className="font-display">{draft.id ? 'Edit brand' : 'New brand'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="brand-name">Name *</Label>
                  <Input id="brand-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand-slug">Slug (auto if blank)</Label>
                  <Input id="brand-slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder={slugify(draft.name)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand-logo">Logo URL</Label>
                  <Input id="brand-logo" value={draft.logoUrl} onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })} placeholder="https://…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand-desc">Description</Label>
                  <Textarea id="brand-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} maxLength={500} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="brand-active">Active</Label>
                  <Switch id="brand-active" checked={draft.isActive} onCheckedChange={(v) => setDraft({ ...draft, isActive: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {draft.id ? 'Save changes' : 'Create brand'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
