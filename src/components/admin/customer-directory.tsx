'use client';

// CustomerDirectory — CRM view with search, B2B/retail filter tabs, WhatsApp deep links.

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/money';
import { api, formatDate } from '@/components/admin/api';

interface CustomerRow {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  companyName: string | null;
  gstin: string | null;
  isB2BVerified: boolean;
  orderCount: number;
  lifetimeValuePaise: number;
  city: string | null;
  createdAt: string;
}

interface ListResponse {
  rows: CustomerRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

type Filter = 'ALL' | 'B2B' | 'RETAIL';

function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^91/, '');
  const text = encodeURIComponent('Hello from Patel Networks — regarding your order/enquiry.');
  return `https://wa.me/91${digits}?text=${text}`;
}

export function CustomerDirectory() {
  const { toast } = useToast();
  const [qInput, setQInput] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
      const params = new URLSearchParams({ page: String(page), perPage: '20', filter });
      if (query) params.set('q', query);
      setData(await api<ListResponse>(`/api/admin/customers?${params.toString()}`));
    } catch (err) {
      toast({ title: 'Failed to load customers', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filter, page, query, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: { key: Filter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'B2B', label: 'B2B' },
    { key: 'RETAIL', label: 'Retail' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search name, phone, company, GSTIN…" className="pl-9 h-9" aria-label="Search customers" />
        </div>
        <div className="flex gap-1.5" role="tablist" aria-label="Customer type filter">
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
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                filter === t.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="max-h-[620px] overflow-auto thin-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Phone / WhatsApp</TableHead>
                <TableHead className="text-xs">Company</TableHead>
                <TableHead className="text-xs">GSTIN</TableHead>
                <TableHead className="text-xs text-center">Orders</TableHead>
                <TableHead className="text-xs text-right">LTV</TableHead>
                <TableHead className="text-xs">City</TableHead>
                <TableHead className="text-xs">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data || data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No customers match this view yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="text-xs font-medium">{c.fullName}</p>
                      {c.isB2BVerified && (
                        <Badge variant="outline" className="mt-0.5 text-[9px] px-1 py-0 bg-[#e7ede9] text-[#1a3c34] border-[#c8d6cf] dark:bg-[#1e332c] dark:text-[#a9d0c0] dark:border-[#2e4a3f]">
                          B2B verified
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs tabular-nums">{c.phone}</span>
                      <a
                        href={whatsappLink(c.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-primary underline underline-offset-2"
                        aria-label={`WhatsApp ${c.fullName}`}
                      >
                        chat <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                      </a>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{c.companyName ?? '—'}</TableCell>
                    <TableCell className="font-mono text-[10px]">{c.gstin ?? '—'}</TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{c.orderCount}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">{formatINR(c.lifetimeValuePaise)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.city ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} customers
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
