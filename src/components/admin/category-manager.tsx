'use client';

// Category manager — table + create/edit dialog + delete guard.

import { useMemo, useState, type FormEvent } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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

export interface AdminCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  hsnCode: string;
  gstRate: number;
  imageUrl: string | null;
  isActive: boolean;
  productCount: number;
}

interface Draft {
  id?: string;
  name: string;
  slug: string;
  description: string;
  parentId: string;
  hsnCode: string;
  gstRate: string;
  imageUrl: string;
  isActive: boolean;
}

const EMPTY: Draft = { name: '', slug: '', description: '', parentId: '', hsnCode: '8525', gstRate: '18', imageUrl: '', isActive: true };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CategoryManager({ categories }: { categories: AdminCategoryRow[] }) {
  const { toast } = useToast();
  const [rows, setRows] = useState(categories);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const parents = useMemo(() => rows.filter((r) => !r.parentId), [rows]);

  function openNew() {
    setDraft({ ...EMPTY });
  }

  function openEdit(row: AdminCategoryRow) {
    setDraft({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? '',
      parentId: row.parentId ?? '',
      hsnCode: row.hsnCode,
      gstRate: String(row.gstRate),
      imageUrl: row.imageUrl ?? '',
      isActive: row.isActive,
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    const payload = {
      name: draft.name.trim(),
      slug: draft.slug.trim() || undefined,
      description: draft.description.trim(),
      parentId: draft.parentId || null,
      hsnCode: draft.hsnCode.trim(),
      gstRate: Math.round(Number(draft.gstRate) || 0),
      imageUrl: draft.imageUrl.trim(),
      isActive: draft.isActive,
    };
    try {
      if (draft.id) {
        const { category } = await api<{ category: AdminCategoryRow }>(`/api/admin/categories/${draft.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setRows((prev) =>
          prev.map((r) =>
            r.id === draft.id
              ? { ...r, ...category, parentName: rows.find((x) => x.id === category.parentId)?.name ?? null, productCount: r.productCount }
              : r
          )
        );
        toast({ title: 'Category updated', description: category.name });
      } else {
        const { category } = await api<{ category: AdminCategoryRow }>('/api/admin/categories', { method: 'POST', body: JSON.stringify(payload) });
        setRows((prev) => [...prev, { ...category, parentName: rows.find((x) => x.id === category.parentId)?.name ?? null, productCount: 0 }]);
        toast({ title: 'Category created', description: category.name });
      }
      setDraft(null);
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: AdminCategoryRow, next: boolean) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: next } : r)));
    try {
      await api(`/api/admin/categories/${row.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: next }) });
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: !next } : r)));
      toast({ title: 'Toggle failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }

  async function remove(row: AdminCategoryRow) {
    if (!window.confirm(`Delete category “${row.name}”? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/categories/${row.id}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast({ title: 'Category deleted', description: row.name });
    } catch (err) {
      toast({ title: 'Delete blocked', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" aria-hidden /> New category
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="max-h-[600px] overflow-auto thin-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs">Parent</TableHead>
                <TableHead className="text-xs text-center">HSN</TableHead>
                <TableHead className="text-xs text-center">GST</TableHead>
                <TableHead className="text-xs text-center">Products</TableHead>
                <TableHead className="text-xs text-center">Live</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No categories yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className={!r.isActive ? 'opacity-60' : undefined}>
                    <TableCell>
                      <p className="text-xs font-medium">{r.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">/{r.slug}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.parentName ?? '— (root)'}</TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{r.hsnCode}</TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{r.gstRate}%</TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{r.productCount}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={r.isActive} onCheckedChange={(v) => void toggleActive(r, v)} aria-label={`Toggle ${r.name}`} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)} aria-label={`Edit ${r.name}`}>
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
        <DialogContent className="sm:max-w-lg">
          {draft && (
            <form onSubmit={save} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-display">{draft.id ? 'Edit category' : 'New category'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cat-name">Name *</Label>
                  <Input id="cat-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-slug">Slug (auto if blank)</Label>
                  <Input id="cat-slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder={slugify(draft.name)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Parent</Label>
                  <Select value={draft.parentId || 'ROOT'} onValueChange={(v) => setDraft({ ...draft, parentId: v === 'ROOT' ? '' : v })}>
                    <SelectTrigger aria-label="Parent category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ROOT">— Root category —</SelectItem>
                      {parents
                        .filter((p) => p.id !== draft.id)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-hsn">HSN code</Label>
                  <Input id="cat-hsn" value={draft.hsnCode} onChange={(e) => setDraft({ ...draft, hsnCode: e.target.value })} className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-gst">GST rate (%)</Label>
                  <Input id="cat-gst" type="number" min={0} max={28} value={draft.gstRate} onChange={(e) => setDraft({ ...draft, gstRate: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cat-img">Image URL</Label>
                  <Input id="cat-img" value={draft.imageUrl} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} placeholder="https://…" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cat-desc">Description</Label>
                  <Textarea id="cat-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} maxLength={500} />
                </div>
                <div className="flex items-center justify-between sm:col-span-2">
                  <Label htmlFor="cat-active">Active</Label>
                  <Switch id="cat-active" checked={draft.isActive} onCheckedChange={(v) => setDraft({ ...draft, isActive: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {draft.id ? 'Save changes' : 'Create category'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
