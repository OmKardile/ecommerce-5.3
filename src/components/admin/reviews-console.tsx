'use client';

// ReviewsConsole — customer review moderation queue.
// Card list with star ratings + product context; approve / un-approve / delete
// with audit on the server. PDP renders only approved rows, so this queue is
// the gate between a submission and the storefront.

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, ExternalLink, Eye, EyeOff, Search, Star, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api, formatDate } from '@/components/admin/api';

interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isApproved: boolean;
  isVerified: boolean;
  createdAt: string;
  user: { fullName: string | null; phone: string | null } | null;
  product: { name: string; slug: string; image: string | null };
}

interface ListResponse {
  items: ReviewRow[];
  total: number;
  pendingCount: number;
  page: number;
  perPage: number;
}

type Filter = 'PENDING' | 'APPROVED' | 'ALL';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-3.5 w-3.5', n <= rating ? 'fill-accent text-accent' : 'text-border')} aria-hidden />
      ))}
    </span>
  );
}

export function ReviewsConsole() {
  const { toast } = useToast();
  const [qInput, setQInput] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(qInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: '20', status: filter });
      if (query) params.set('q', query);
      setData(await api<ListResponse>(`/api/admin/reviews?${params.toString()}`));
    } catch (err) {
      toast({ title: 'Failed to load reviews', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filter, page, query, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(row: ReviewRow, isApproved: boolean) {
    if (busyId) return;
    setBusyId(row.id);
    try {
      await api(`/api/admin/reviews/${row.id}`, { method: 'PATCH', body: JSON.stringify({ isApproved }) });
      toast({
        title: isApproved ? 'Review approved' : 'Review un-published',
        description: `${row.product.name} — now ${isApproved ? 'visible on the product page' : 'back in the pending queue'}.`,
      });
      await load();
    } catch (err) {
      toast({ title: 'Update failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: ReviewRow) {
    if (busyId) return;
    setBusyId(row.id);
    try {
      await api(`/api/admin/reviews/${row.id}`, { method: 'DELETE' });
      toast({ title: 'Review deleted', description: `${row.product.name} — removed permanently.`, variant: 'destructive' });
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      toast({ title: 'Delete failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'ALL', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search product, reviewer, phone, text…"
            className="pl-9 h-9"
            aria-label="Search reviews"
          />
        </div>
        <div className="flex gap-1.5" role="tablist" aria-label="Review moderation filter">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={filter === t.key}
              onClick={() => {
                setFilter(t.key);
                setPage(1);
              }}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.97]',
                filter === t.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {t.key === 'PENDING' && Boolean(data?.pendingCount) && (
                <span className="ml-1.5 rounded-full bg-[#f7f6f1] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#142a24] tabular-nums">
                  {data?.pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
          <Star className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 font-display text-xl">
            {filter === 'PENDING' ? 'Queue is clear.' : 'No reviews in this view.'}
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            {filter === 'PENDING'
              ? 'Every customer review has been moderated. New submissions land here the moment they arrive.'
              : 'Reviews written on the storefront will appear here once customers submit them.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Customer reviews">
          {data.items.map((row) => (
            <li key={row.id} className="rounded-lg border border-border bg-card p-4 sm:p-5 transition-shadow hover:shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <a
                    href={`/products/${row.product.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:block"
                    aria-label={`Open ${row.product.name} product page`}
                  >
                    {row.product.image ? (
                      <img src={row.product.image} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
                    ) : (
                      <Star className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                  </a>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars rating={row.rating} />
                      {row.title && <p className="truncate text-sm font-semibold">{row.title}</p>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">{row.user?.fullName ?? 'Storefront customer'}</span>
                      {row.user?.phone && <span className="font-mono tabular-nums">{row.user.phone}</span>}
                      {row.isVerified && (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <BadgeCheck className="h-3 w-3" aria-hidden /> Verified purchase
                        </span>
                      )}
                      <span>· {formatDate(row.createdAt, true)}</span>
                    </div>
                    <a
                      href={`/products/${row.product.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-primary underline underline-offset-2"
                    >
                      On: {row.product.name} <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden />
                    </a>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] uppercase tracking-wide',
                    row.isApproved ? 'bg-[#e7ede9] text-[#1a3c34] border-[#c8d6cf]' : 'bg-[#f4ead8] text-[#7a5a1d] border-[#e2cfa8]',
                  )}
                >
                  {row.isApproved ? 'Live' : 'Pending'}
                </Badge>
              </div>

              {row.comment && (
                <blockquote className="mt-3 whitespace-pre-wrap border-l-2 border-border pl-3 text-sm leading-relaxed text-foreground/90">
                  {row.comment}
                </blockquote>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {row.isApproved ? (
                  <Button size="sm" variant="outline" className="h-8 active:scale-[0.97]" disabled={busyId === row.id} onClick={() => patch(row, false)}>
                    {busyId === row.id ? 'Saving…' : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" aria-hidden /> Un-publish
                      </>
                    )}
                  </Button>
                ) : (
                  <Button size="sm" className="h-8 active:scale-[0.97]" disabled={busyId === row.id} onClick={() => patch(row, true)}>
                    {busyId === row.id ? 'Saving…' : (
                      <>
                        <Eye className="h-3.5 w-3.5" aria-hidden /> Approve
                      </>
                    )}
                  </Button>
                )}
                {confirmDeleteId === row.id ? (
                  <span className="inline-flex items-center gap-2">
                    <Button size="sm" variant="destructive" className="h-8 active:scale-[0.97]" disabled={busyId === row.id} onClick={() => remove(row)}>
                      {busyId === row.id ? 'Deleting…' : 'Confirm delete'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setConfirmDeleteId(null)}>
                      <Undo2 className="h-3.5 w-3.5" aria-hidden /> Keep
                    </Button>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    disabled={busyId === row.id}
                    onClick={() => setConfirmDeleteId(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                  </Button>
                )}
                {row.isApproved && (
                  <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden /> Showing on the product page
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.total > data.perPage && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {data.page} · {data.total} reviews
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page * data.perPage >= data.total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
