'use client';

// InquiryInbox — trade desk pipeline for B2B/wholesale inquiries.
// Card list (messages are long), status tabs, forward-only FSM with note capture.

import { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, ExternalLink, MessageSquareQuote, Phone, Search, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api, formatDate } from '@/components/admin/api';

interface InquiryRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  companyName: string | null;
  gstin: string | null;
  message: string;
  status: 'NEW' | 'CONTACTED' | 'CLOSED';
  note: string | null;
  handledAt: string | null;
  createdAt: string;
  product: { name: string; slug: string } | null;
  /** Raw reference text when it did not resolve to a real product (e.g. "Product reference: Platform enquiry (showcase page)"). */
  productRef: string | null;
}

interface ListResponse {
  items: InquiryRow[];
  total: number;
  openCount: number;
  page: number;
  perPage: number;
}

type Filter = 'ALL' | 'NEW' | 'CONTACTED' | 'CLOSED';

const STATUS_STYLE: Record<InquiryRow['status'], string> = {
  NEW: 'bg-[#f4ead8] text-[#7a5a1d] border-[#e2cfa8] dark:bg-[#33270f] dark:text-[#d9b06a] dark:border-[#4d3c1c]',
  CONTACTED: 'bg-[#e7ede9] text-[#1a3c34] border-[#c8d6cf] dark:bg-[#1e332c] dark:text-[#a9d0c0] dark:border-[#2e4a3f]',
  CLOSED: 'bg-muted text-muted-foreground border-border',
};

function whatsappLink(phone: string, name: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^91/, '');
  const text = encodeURIComponent(`Hello ${name}, Patel Networks trade desk here — regarding your hardware enquiry.`);
  return `https://wa.me/91${digits}?text=${text}`;
}

export function InquiryInbox() {
  const { toast } = useToast();
  const [qInput, setQInput] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('NEW');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

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
      setData(await api<ListResponse>(`/api/admin/inquiries?${params.toString()}`));
    } catch (err) {
      toast({ title: 'Failed to load inquiries', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filter, page, query, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(row: InquiryRow, status: InquiryRow['status']) {
    if (busyId) return;
    setBusyId(row.id);
    try {
      const note = notes[row.id]?.trim();
      await api(`/api/admin/inquiries/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(note !== undefined && note !== '' ? { note } : {}) }),
      });
      toast({
        title: `Marked ${status.toLowerCase()}`,
        description: `${row.name} — ${row.companyName ?? 'retail'} inquiry updated.`,
      });
      await load();
    } catch (err) {
      toast({ title: 'Update failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'NEW', label: 'New' },
    { key: 'CONTACTED', label: 'Contacted' },
    { key: 'CLOSED', label: 'Closed' },
    { key: 'ALL', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search name, phone, company, email…" className="pl-9 h-9" aria-label="Search inquiries" />
        </div>
        <div className="flex gap-1.5" role="tablist" aria-label="Inquiry status filter">
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
                filter === t.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
              {t.key === 'NEW' && Boolean(data?.openCount) && (
                <span className="ml-1.5 rounded-full bg-[#f7f6f1] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#142a24] tabular-nums dark:bg-[#1e332c] dark:text-[#cfe3d8]">
                  {data?.openCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-3">
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
          <MessageSquareQuote className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 font-display text-xl">No inquiries in this view.</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            B2B quote requests from the storefront contact form land here the moment they arrive.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="B2B inquiries">
          {data.items.map((row) => {
            const next: InquiryRow['status'] | null = row.status === 'NEW' ? 'CONTACTED' : row.status === 'CONTACTED' ? 'CLOSED' : null;
            return (
              <li key={row.id} className="rounded-lg border border-border bg-card p-4 sm:p-5 transition-shadow hover:shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{row.name}</p>
                      {row.companyName && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" aria-hidden /> {row.companyName}
                        </span>
                      )}
                      {row.gstin && <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{row.gstin}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1 tabular-nums hover:text-foreground">
                        <Phone className="h-3 w-3" aria-hidden /> {row.phone}
                      </a>
                      <a href={whatsappLink(row.phone, row.name)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2">
                        WhatsApp <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                      </a>
                      {row.email && <span>{row.email}</span>}
                      <span>· {formatDate(row.createdAt, true)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wide', STATUS_STYLE[row.status])}>
                      {row.status}
                    </Badge>
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2.5 text-sm leading-relaxed text-foreground/90">
                  {row.message}
                </p>

                {row.product && (
                  <a
                    href={`/products/${row.product.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs text-primary underline underline-offset-2"
                  >
                    Re: {row.product.name} <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden />
                  </a>
                )}

                {!row.product && row.productRef && (
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">Re:</span> {row.productRef}
                  </p>
                )}

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label htmlFor={`note-${row.id}`} className="label-caps !text-[10px] mb-1 block">
                      Trade desk note
                    </label>
                    <Textarea
                      id={`note-${row.id}`}
                      value={notes[row.id] ?? row.note ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
                      placeholder={row.note ?? 'Quoted price, agreed next step…'}
                      rows={2}
                      className="min-h-[60px] text-sm"
                      maxLength={1000}
                    />
                    {row.handledAt && <p className="mt-1 text-[10px] text-muted-foreground">First handled {formatDate(row.handledAt, true)}</p>}
                  </div>
                  {next && (
                    <Button
                      size="sm"
                      className="h-9 shrink-0 active:scale-[0.97]"
                      disabled={busyId === row.id}
                      onClick={() => patch(row, next)}
                    >
                      {busyId === row.id ? 'Saving…' : (
                        <>
                          {next === 'CONTACTED' ? 'Mark contacted' : 'Close inquiry'}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </>
                      )}
                    </Button>
                  )}
                  {!next && row.status === 'CLOSED' && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden /> Pipeline complete
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.total > data.perPage && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {data.page} · {data.total} inquiries
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
