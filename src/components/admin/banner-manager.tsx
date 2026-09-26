'use client';

// Banner manager — HOME_HERO / HOME_STRIP placements, image preview cards,
// active switch + create/edit dialog (adminBannerSchema via /api/admin/banners).

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/components/admin/api';

interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  placement: 'HOME_HERO' | 'HOME_STRIP';
  sortOrder: number;
  isActive: boolean;
}

interface Draft {
  id?: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  placement: 'HOME_HERO' | 'HOME_STRIP';
  sortOrder: string;
  isActive: boolean;
}

const EMPTY: Draft = { title: '', subtitle: '', imageUrl: '', linkUrl: '', placement: 'HOME_HERO', sortOrder: '0', isActive: true };

function placementLabel(p: string): string {
  return p === 'HOME_HERO' ? 'Home hero' : 'Home strip';
}

export function BannerManager() {
  const { toast } = useToast();
  const [rows, setRows] = useState<BannerRow[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ banners: BannerRow[] }>('/api/admin/banners');
      setRows(res.banners);
    } catch (err) {
      toast({ title: 'Failed to load banners', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
      setRows([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(r: BannerRow) {
    setDraft({
      id: r.id,
      title: r.title,
      subtitle: r.subtitle ?? '',
      imageUrl: r.imageUrl,
      linkUrl: r.linkUrl ?? '',
      placement: r.placement,
      sortOrder: String(r.sortOrder),
      isActive: r.isActive,
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    const payload = {
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim(),
      imageUrl: draft.imageUrl.trim(),
      linkUrl: draft.linkUrl.trim(),
      placement: draft.placement,
      sortOrder: Number(draft.sortOrder) || 0,
      isActive: draft.isActive,
    };
    try {
      if (draft.id) {
        await api(`/api/admin/banners/${draft.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast({ title: 'Banner updated', description: payload.title });
      } else {
        await api('/api/admin/banners', { method: 'POST', body: JSON.stringify(payload) });
        toast({ title: 'Banner created', description: payload.title });
      }
      setDraft(null);
      await load();
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(r: BannerRow, next: boolean) {
    setRows((prev) => (prev ? prev.map((b) => (b.id === r.id ? { ...b, isActive: next } : b)) : prev));
    try {
      await api(`/api/admin/banners/${r.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: next }) });
    } catch (err) {
      setRows((prev) => (prev ? prev.map((b) => (b.id === r.id ? { ...b, isActive: !next } : b)) : prev));
      toast({ title: 'Toggle failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }

  async function remove(r: BannerRow) {
    if (!window.confirm(`Delete banner "${r.title}"?`)) return;
    try {
      await api(`/api/admin/banners/${r.id}`, { method: 'DELETE' });
      toast({ title: 'Banner deleted', description: r.title });
      await load();
    } catch (err) {
      toast({ title: 'Delete failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="h-4 w-4" aria-hidden /> New banner
        </Button>
      </div>

      {rows === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-md" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No banners yet — create a hero or strip creative for the storefront.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <article
              key={r.id}
              className={`group overflow-hidden rounded-md border border-border bg-card transition-opacity ${r.isActive ? '' : 'opacity-60'}`}
              aria-label={`Banner: ${r.title}`}
            >
              <div className="relative aspect-[16/7] overflow-hidden bg-muted">
                <img src={r.imageUrl} alt={r.title} className="h-full w-full object-cover" loading="lazy" />
                <Badge variant="outline" className="absolute left-2 top-2 bg-background/90 text-[10px] uppercase tracking-wide">
                  {placementLabel(r.placement)}
                </Badge>
              </div>
              <div className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    {r.subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.subtitle}</p>}
                  </div>
                  <Switch checked={r.isActive} onCheckedChange={(v) => void toggleActive(r, v)} aria-label={`Toggle ${r.title}`} />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 font-mono text-[10px]">#{r.sortOrder}</span>
                    {r.linkUrl ? (
                      <a
                        href={r.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-w-0 items-center gap-1 underline underline-offset-2 hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate max-w-[160px]">{r.linkUrl}</span>
                      </a>
                    ) : (
                      <span>No link</span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)} aria-label={`Edit ${r.title}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void remove(r)} aria-label={`Delete ${r.title}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          {draft && (
            <form onSubmit={save} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-display">{draft.id ? 'Edit banner' : 'New banner'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bn-title">Title *</Label>
                  <Input id="bn-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} required />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bn-sub">Subtitle</Label>
                  <Input id="bn-sub" value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} maxLength={220} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bn-img">Image URL *</Label>
                  <Input id="bn-img" type="url" value={draft.imageUrl} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} placeholder="https://…" required />
                  {draft.imageUrl && (
                    <div className="mt-1 aspect-[16/7] overflow-hidden rounded-md border border-border bg-muted">
                      <img src={draft.imageUrl} alt="Banner preview" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bn-link">Link URL</Label>
                  <Input id="bn-link" value={draft.linkUrl} onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })} placeholder="/products or https://…" maxLength={300} />
                </div>
                <div className="space-y-1.5">
                  <Label>Placement</Label>
                  <Select value={draft.placement} onValueChange={(v) => setDraft({ ...draft, placement: v as Draft['placement'] })}>
                    <SelectTrigger aria-label="Banner placement">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HOME_HERO">Home hero</SelectItem>
                      <SelectItem value="HOME_STRIP">Home strip</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bn-order">Sort order</Label>
                  <Input id="bn-order" type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} />
                </div>
                <div className="flex items-center justify-between sm:col-span-2">
                  <Label htmlFor="bn-active">Active</Label>
                  <Switch id="bn-active" checked={draft.isActive} onCheckedChange={(v) => setDraft({ ...draft, isActive: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {draft.id ? 'Save changes' : 'Create banner'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
