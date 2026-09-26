'use client';

// Products table — inline active/COD toggles (optimistic), search, edit links.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
import { formatINR } from '@/lib/money';

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  brandName: string;
  categoryName: string;
  isActive: boolean;
  isCodAllowed: boolean;
  isFeatured: boolean;
  variantsCount: number;
  priceFromPaise: number;
  stockTotal: number;
  imageUrl: string | null;
}

export function ProductsTable({ products }: { products: AdminProductRow[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [rows, setRows] = useState(products);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => `${r.name} ${r.slug} ${r.brandName} ${r.categoryName}`.toLowerCase().includes(needle));
  }, [rows, q]);

  async function toggle(row: AdminProductRow, field: 'isActive' | 'isCodAllowed', next: boolean) {
    // optimistic update, revert on failure
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [field]: next } : r)));
    try {
      await api(`/api/admin/products/${row.id}`, { method: 'PATCH', body: JSON.stringify({ [field]: next }) });
      toast({
        title: field === 'isActive' ? (next ? 'Product live' : 'Product hidden') : next ? 'COD enabled' : 'COD disabled',
        description: row.name,
      });
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [field]: !next } : r)));
      toast({ title: 'Toggle failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, brands…" className="pl-9 h-9" aria-label="Search products" />
        </div>
        <Button asChild size="sm" className="ml-auto">
          <Link href="/admin/products/new">New product</Link>
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="max-h-[640px] overflow-auto thin-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs text-center">Variants</TableHead>
                <TableHead className="text-xs text-right">Price from</TableHead>
                <TableHead className="text-xs text-right">Stock</TableHead>
                <TableHead className="text-xs text-center">Live</TableHead>
                <TableHead className="text-xs text-center">COD</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    {q ? `No products match “${q}”.` : 'No products yet — create your first one.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {r.imageUrl ? (
                          <img src={r.imageUrl} alt="" className="h-9 w-9 rounded-md object-cover border border-border" />
                        ) : (
                          <div className="h-9 w-9 rounded-md bg-muted border border-border" aria-hidden />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium max-w-[240px] truncate">{r.name}</p>
                          <p className="text-[11px] text-muted-foreground">{r.brandName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.categoryName}</TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{r.variantsCount}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">{formatINR(r.priceFromPaise)}</TableCell>
                    <TableCell className="text-right">
                      <span className={r.stockTotal === 0 ? 'text-destructive text-xs font-medium tabular-nums' : 'text-xs tabular-nums'}>{r.stockTotal}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={r.isActive} onCheckedChange={(v) => void toggle(r, 'isActive', v)} aria-label={`Toggle live for ${r.name}`} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={r.isCodAllowed} onCheckedChange={(v) => void toggle(r, 'isCodAllowed', v)} aria-label={`Toggle COD for ${r.name}`} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.isFeatured && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            Featured
                          </Badge>
                        )}
                        <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                          <Link href={`/admin/products/${r.id}`}>Edit</Link>
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
      <p className="text-[11px] text-muted-foreground">
        {filtered.length} of {rows.length} products · Toggles update instantly; stock edits live inside each product&apos;s edit form (audited).
      </p>
    </div>
  );
}
