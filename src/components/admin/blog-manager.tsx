'use client';

// Blog manager — posts table + markdown editor sheet. Publishing stamps publishedAt
// server-side on the first PUBLISHED transition (re-drafts keep the original date).

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Eye, FileText, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api, formatDate } from '@/components/admin/api';

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  tags: string | null;
  createdAt: string;
}

interface Draft {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  status: 'DRAFT' | 'PUBLISHED';
  tags: string;
}

const EMPTY: Draft = { title: '', slug: '', excerpt: '', content: '', coverImageUrl: '', status: 'DRAFT', tags: '' };

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function slugifyLocal(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function BlogManager() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PostRow[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ posts: PostRow[] }>('/api/admin/posts');
      setRows(res.posts);
    } catch (err) {
      toast({ title: 'Failed to load posts', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
      setRows([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(r: PostRow) {
    setDraft({
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt ?? '',
      content: r.content,
      coverImageUrl: r.coverImageUrl ?? '',
      status: r.status,
      tags: parseTags(r.tags).join(', '),
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    const payload = {
      title: draft.title.trim(),
      slug: draft.slug.trim() || slugifyLocal(draft.title),
      excerpt: draft.excerpt.trim(),
      content: draft.content,
      coverImageUrl: draft.coverImageUrl.trim(),
      status: draft.status,
      tags: draft.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      if (draft.id) {
        await api(`/api/admin/posts/${draft.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast({ title: 'Post updated', description: payload.title });
      } else {
        await api('/api/admin/posts', { method: 'POST', body: JSON.stringify(payload) });
        toast({ title: 'Post created', description: payload.title });
      }
      setDraft(null);
      await load();
    } catch (err) {
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(r: PostRow) {
    const next = r.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setRows((prev) => (prev ? prev.map((p) => (p.id === r.id ? { ...p, status: next } : p)) : prev));
    try {
      await api(`/api/admin/posts/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      toast({ title: next === 'PUBLISHED' ? 'Post published' : 'Post moved to drafts', description: r.title });
    } catch (err) {
      toast({ title: 'Publish toggle failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      await load();
    }
  }

  async function remove(r: PostRow) {
    if (!window.confirm(`Delete post "${r.title}"? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/posts/${r.id}`, { method: 'DELETE' });
      toast({ title: 'Post deleted', description: r.title });
      await load();
    } catch (err) {
      toast({ title: 'Delete failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="h-4 w-4" aria-hidden /> New post
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="max-h-[600px] overflow-auto thin-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Title</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Tags</TableHead>
                <TableHead className="text-xs">Published</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows === null ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No posts yet — write your first journal entry.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[320px]">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">/blog/{r.slug}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.status === 'PUBLISHED' ? 'bg-green-100 text-green-900 border-green-200 text-[11px]' : 'bg-stone-200/70 text-stone-800 border-stone-300 text-[11px]'}>
                        {r.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <p className="truncate text-xs text-muted-foreground">{parseTags(r.tags).join(', ') || '—'}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.publishedAt ? formatDate(r.publishedAt) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void togglePublish(r)} aria-label={r.status === 'PUBLISHED' ? `Unpublish ${r.title}` : `Publish ${r.title}`}>
                          {r.status === 'PUBLISHED' ? <Eye className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                        </Button>
                        {r.status === 'PUBLISHED' && (
                          <a
                            href={`/blog/${r.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            aria-label={`View ${r.title} on storefront`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)} aria-label={`Edit ${r.title}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void remove(r)} aria-label={`Delete ${r.title}`}>
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

      <Sheet open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto thin-scrollbar p-6" side="right">
          {draft && (
            <form onSubmit={save} className="space-y-4">
              <SheetHeader className="p-0">
                <SheetTitle className="font-display">{draft.id ? 'Edit post' : 'New post'}</SheetTitle>
                <p className="text-xs text-muted-foreground">Markdown supported (headings, tables, lists). Publish stamps the go-live date.</p>
              </SheetHeader>
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="po-title">Title *</Label>
                  <Input id="po-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={160} required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="po-slug">Slug</Label>
                    <Input id="po-slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: slugifyLocal(e.target.value) })} placeholder={slugifyLocal(draft.title) || 'auto-from-title'} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as Draft['status'] })}>
                      <SelectTrigger aria-label="Post status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="PUBLISHED">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po-excerpt">Excerpt</Label>
                  <Textarea id="po-excerpt" value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} maxLength={300} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po-content">Content (markdown) *</Label>
                  <Textarea
                    id="po-content"
                    value={draft.content}
                    onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                    rows={14}
                    className="font-mono text-[13px] min-h-64"
                    placeholder={'## Heading\n\nBody copy with **bold**, tables and bullet lists…'}
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">{draft.content.trim().length} characters · minimum 20</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po-cover">Cover image URL</Label>
                  <Input id="po-cover" type="url" value={draft.coverImageUrl} onChange={(e) => setDraft({ ...draft, coverImageUrl: e.target.value })} placeholder="https://… (optional — typographic panel when empty)" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="po-tags">Tags</Label>
                  <Input id="po-tags" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="cctv, buying-guide, networking" />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {draft.id ? 'Save changes' : 'Create post'}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
