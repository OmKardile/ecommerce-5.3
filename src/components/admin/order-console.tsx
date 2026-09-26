'use client';

// OrderFulfillmentConsole — dense ops table + detail sheet: FSM transitions, serial number
// capture, AWB booking, carrier-scan simulation, CSV export. All mutations via admin APIs.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Search,
  StickyNote,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/money';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/constants';
import { api, formatDate, ApiError } from '@/components/admin/api';
import { allowedNextStatuses, OrderStatusBadge, ShipmentStatusBadge } from '@/components/admin/status-badge';
import { downloadCsv, toCsv } from '@/components/admin/csv';

// ---------- types (JSON shapes from the admin APIs) ----------

interface ItemRow {
  id: string;
  productName: string;
  variantName: string;
  skuCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  serialNumbers: string | null;
  productSlug: string | null;
}

interface PaymentRow {
  id: string;
  method: string;
  status: string;
  amount: number;
}

interface TrackingEventRow {
  eventId: string;
  status: string;
  location: string | null;
  occurredAt: string;
}

interface ShipmentRow {
  id: string;
  awb: string | null;
  courierName: string | null;
  provider: string;
  status: string;
  trackingUrl: string | null;
  events?: TrackingEventRow[];
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  isB2B: boolean;
  gstin: string | null;
  companyName: string | null;
  subtotal: number;
  discountAmount: number;
  bundleDiscount: number;
  couponCode: string | null;
  shippingAmount: number;
  codFee: number;
  gstAmount: number;
  totalAmount: number;
  deliveryName: string;
  deliveryPhone: string;
  deliveryLine1: string;
  deliveryLine2: string | null;
  deliveryLandmark: string | null;
  deliveryCity: string;
  deliveryState: string;
  deliveryPincode: string;
  customerNote: string | null;
  createdAt: string;
  items: ItemRow[];
  payments: PaymentRow[];
  shipments: ShipmentRow[];
  statusHistory?: HistoryRow[];
  user: { phone: string; fullName: string | null; customer: { isB2BVerified: boolean; gstin: string | null; companyName: string | null } | null } | null;
}

interface HistoryRow {
  status: string;
  comment: string | null;
  changedBy: string | null;
  createdAt: string;
}

interface ListResponse {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  counts: Record<string, number>;
  orders: OrderRow[];
}

const TAB_STATUSES: string[] = ['ALL', ...ORDER_STATUSES];

export function OrderFulfillmentConsole({ initialStatus = 'ALL' }: { initialStatus?: string }) {
  const { toast } = useToast();
  const [qInput, setQInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(TAB_STATUSES.includes(initialStatus) ? initialStatus : 'ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<OrderRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // debounce search
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
      const params = new URLSearchParams({ page: String(page), perPage: '20', status });
      if (query) params.set('q', query);
      const res = await api<ListResponse>(`/api/admin/orders?${params.toString()}`);
      setData(res);
    } catch (err) {
      toast({ title: 'Failed to load orders', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, query, status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback(
    async (orderId: string) => {
      setDetailLoading(true);
      try {
        const d = await api<OrderRow>(`/api/admin/orders/${orderId}`);
        setDetail(d);
      } catch (err) {
        toast({ title: 'Failed to load order detail', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
      } finally {
        setDetailLoading(false);
      }
    },
    [toast]
  );

  function refreshAll() {
    void load();
    if (detail) void openDetail(detail.id);
  }

  function exportCsv() {
    if (!data || data.orders.length === 0) {
      toast({ title: 'Nothing to export', description: 'Load at least one order first.' });
      return;
    }
    const csv = toCsv(
      ['orderNumber', 'date', 'recipient', 'phone', 'city', 'state', 'pincode', 'gstin', 'total', 'gst', 'status', 'payment', 'awb'],
      data.orders.map((o) => [
        o.orderNumber,
        formatDate(o.createdAt, true),
        o.deliveryName,
        o.deliveryPhone,
        o.deliveryCity,
        o.deliveryState,
        o.deliveryPincode,
        o.gstin ?? '',
        (o.totalAmount / 100).toFixed(2),
        (o.gstAmount / 100).toFixed(2),
        o.status,
        o.paymentMethod,
        o.shipments[0]?.awb ?? '',
      ])
    );
    downloadCsv(`patel-orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast({ title: `Exported ${data.orders.length} orders`, description: 'RFC4180 CSV downloaded.' });
  }

  const counts = data?.counts ?? {};

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search order #, phone, name, city, AWB…"
            className="pl-9 h-9"
            aria-label="Search orders"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} aria-label="Refresh orders">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </Button>
        </div>
      </div>

      {/* Status tab bar */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Filter by order status">
        {TAB_STATUSES.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              status === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40'
            )}
          >
            {s === 'ALL' ? 'All' : ORDER_STATUS_LABELS[s as OrderStatus] ?? s}
            <span className={cn('rounded px-1 text-[10px] tabular-nums', status === s ? 'bg-white/15' : 'bg-muted')}>
              {counts[s] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="max-h-[600px] overflow-auto thin-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Order</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs text-center">Items</TableHead>
                <TableHead className="text-xs text-right">Total</TableHead>
                <TableHead className="text-xs">Payment</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">AWB</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data || data.orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    No orders match this view. {query ? `Try clearing “${query}”.` : 'New orders appear here as customers check out.'}
                  </TableCell>
                </TableRow>
              ) : (
                data.orders.map((o) => (
                  <TableRow
                    key={o.id}
                    onClick={() => void openDetail(o.id)}
                    className="cursor-pointer"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void openDetail(o.id);
                    }}
                    aria-label={`Open order ${o.orderNumber}`}
                  >
                    <TableCell className="font-mono text-xs font-medium whitespace-nowrap">{o.orderNumber}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{formatDate(o.createdAt, true)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium max-w-[160px] truncate">{o.deliveryName}</span>
                        {o.isB2B && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-[#e7ede9] text-[#1a3c34] border-[#c8d6cf]">
                            B2B
                          </Badge>
                        )}
                      </div>
                      {/* tel: deep-link — stopPropagation keeps the row's sheet closed */}
                      <a
                        href={`tel:${o.deliveryPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] text-muted-foreground hover:text-primary tabular-nums"
                        aria-label={`Call ${o.deliveryName}`}
                      >
                        {o.deliveryPhone}
                      </a>
                    </TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{o.items.reduce((n, i) => n + i.quantity, 0)}</TableCell>
                    <TableCell className="text-right text-xs font-medium tabular-nums whitespace-nowrap">{formatINR(o.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                        {o.paymentMethod === 'COD' ? 'COD' : 'Prepaid'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">{o.shipments[0]?.awb ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} orders
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

      <OrderDetailSheet
        detail={detail}
        open={detail !== null || detailLoading}
        loading={detailLoading}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        onMutate={refreshAll}
      />
    </div>
  );
}

// ================= Detail sheet =================

function OrderDetailSheet({
  detail,
  open,
  loading,
  onOpenChange,
  onMutate,
}: {
  detail: OrderRow | null;
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onMutate: () => void;
}) {
  const { toast } = useToast();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto thin-scrollbar p-0" side="right">
        {loading && !detail ? (
          <div className="p-6 space-y-4">
            {/* Radix requires a Title inside Content at mount — the skeleton
                branch renders none, so keep an invisible one for a11y */}
            <SheetTitle className="sr-only">Order detail</SheetTitle>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : detail ? (
          <div className="p-6 space-y-6">
            <SheetHeader className="p-0">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="font-mono text-lg">{detail.orderNumber}</SheetTitle>
                <OrderStatusBadge status={detail.status} />
                <Badge variant="outline" className="text-[10px]">
                  {detail.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Prepaid'}
                </Badge>
                {detail.isB2B && (
                  <Badge variant="outline" className="text-[10px] bg-[#e7ede9] text-[#1a3c34] border-[#c8d6cf]">
                    B2B{detail.gstin ? ` · ${detail.gstin}` : ''}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Placed {formatDate(detail.createdAt, true)}</p>
            </SheetHeader>

            <StatusActions detail={detail} onDone={onMutate} />
            <ShipmentPanel detail={detail} onDone={onMutate} />

            <section aria-label="Items and serial numbers">
              <h3 className="label-caps mb-2">Items &amp; serial capture</h3>
              <div className="space-y-2">
                {detail.items.map((item) => (
                  <SerialEditor key={item.id} item={item} onSaved={onMutate} />
                ))}
              </div>
            </section>

            <Separator />

            <section aria-label="Delivery address" className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="label-caps mb-2 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Delivery address
                </h3>
                <div className="text-sm space-y-0.5">
                  <p className="font-medium">{detail.deliveryName}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
                    <a
                      href={`tel:${detail.deliveryPhone}`}
                      className="tabular-nums hover:text-primary"
                      aria-label={`Call ${detail.deliveryName}`}
                    >
                      {detail.deliveryPhone}
                    </a>
                    <a
                      href={waLink(detail.deliveryPhone)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 text-xs text-primary underline underline-offset-2"
                      aria-label={`WhatsApp ${detail.deliveryName}`}
                    >
                      WhatsApp
                    </a>
                  </p>
                  <p className="text-muted-foreground">
                    {detail.deliveryLine1}
                    {detail.deliveryLine2 ? `, ${detail.deliveryLine2}` : ''}
                    {detail.deliveryLandmark ? ` (${detail.deliveryLandmark})` : ''}
                  </p>
                  <p className="text-muted-foreground">
                    {detail.deliveryCity}, {detail.deliveryState} — {detail.deliveryPincode}
                  </p>
                  <a
                    href={mapsLink(detail)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                    aria-label={`Open delivery address in Google Maps for ${detail.orderNumber}`}
                  >
                    <MapPin className="h-3 w-3" aria-hidden /> Open in Maps
                  </a>
                </div>
              </div>
              <div>
                <h3 className="label-caps mb-2">Bill summary</h3>
                <dl className="text-sm space-y-1">
                  <Row label="Subtotal" value={formatINR(detail.subtotal)} />
                  {detail.discountAmount > 0 && <Row label={`Discount${detail.couponCode ? ` (${detail.couponCode})` : ''}`} value={`− ${formatINR(detail.discountAmount)}`} />}
                  {detail.bundleDiscount > 0 && <Row label="Bundle discount" value={`− ${formatINR(detail.bundleDiscount)}`} />}
                  <Row label="Shipping" value={detail.shippingAmount === 0 ? 'Free' : formatINR(detail.shippingAmount)} />
                  {detail.codFee > 0 && <Row label="COD fee" value={formatINR(detail.codFee)} />}
                  <Row label="GST (incl.)" value={formatINR(detail.gstAmount)} />
                  <Separator className="my-1.5" />
                  <div className="flex justify-between font-medium">
                    <dt>Total</dt>
                    <dd className="font-display">{formatINR(detail.totalAmount)}</dd>
                  </div>
                </dl>
                {detail.customerNote && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/50 p-2.5 text-xs text-muted-foreground">
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      <span className="font-medium text-foreground">Customer note: </span>
                      {detail.customerNote.replace(/^idem:[^|]+\|?\s*/, '')}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {detail.statusHistory && detail.statusHistory.length > 0 && (
              <section aria-label="Status history">
                <h3 className="label-caps mb-2">Status history</h3>
                <ol className="space-y-1.5 text-xs text-muted-foreground">
                  {detail.statusHistory.map((h, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{ORDER_STATUS_LABELS[h.status as OrderStatus] ?? h.status}</span>
                      <span>· {formatDate(h.createdAt, true)}</span>
                      {h.changedBy && <span className="text-[10px] uppercase tracking-wide">· {h.changedBy}</span>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function StatusActions({ detail, onDone }: { detail: OrderRow; onDone: () => void }) {
  const { toast } = useToast();
  const [busyStatus, setBusyStatus] = useState<string | null>(null);
  const nexts = useMemo(() => allowedNextStatuses(detail.status), [detail.status]);

  async function transition(next: OrderStatus) {
    if (next === 'CANCELLED' && !window.confirm(`Cancel order ${detail.orderNumber}? Reserved stock will be released.`)) return;
    setBusyStatus(next);
    try {
      await api('/api/admin/orders/transition', {
        method: 'POST',
        body: JSON.stringify({ orderId: detail.id, status: next }),
      });
      toast({ title: `Order moved to ${ORDER_STATUS_LABELS[next]}`, description: detail.orderNumber });
      onDone();
    } catch (err) {
      toast({
        title: 'Transition rejected',
        description: err instanceof ApiError ? err.message : 'Invalid transition',
        variant: 'destructive',
      });
    } finally {
      setBusyStatus(null);
    }
  }

  if (nexts.length === 0) {
    return (
      <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Terminal state — no further transitions permitted by the order state machine.
      </p>
    );
  }

  return (
    <div>
      <h3 className="label-caps mb-2">Move order forward</h3>
      <div className="flex flex-wrap gap-2">
        {nexts.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={s === 'CANCELLED' || s === 'REFUNDED' ? 'outline' : 'default'}
            disabled={busyStatus !== null}
            onClick={() => void transition(s)}
            className="h-8 text-xs"
          >
            {busyStatus === s && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {ORDER_STATUS_LABELS[s]}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ShipmentPanel({ detail, onDone }: { detail: OrderRow; onDone: () => void }) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<'SHIPROCKET' | 'DELHIVERY'>('SHIPROCKET');
  const [booking, setBooking] = useState(false);
  const [advanceStatus, setAdvanceStatus] = useState<'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED'>('IN_TRANSIT');
  const [advancing, setAdvancing] = useState(false);

  const shipment = detail.shipments?.[0];

  async function book() {
    setBooking(true);
    try {
      const s = await api<{ awb: string; courier: string | null }>('/api/admin/orders/shipment', {
        method: 'POST',
        body: JSON.stringify({ orderId: detail.id, provider }),
      });
      toast({ title: 'Shipment booked', description: `AWB ${s.awb} · ${s.courier ?? provider}` });
      onDone();
    } catch (err) {
      toast({ title: 'Booking failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBooking(false);
    }
  }

  async function advance() {
    if (!shipment?.awb) return;
    setAdvancing(true);
    try {
      await api('/api/admin/orders/shipment/advance', {
        method: 'POST',
        body: JSON.stringify({ awb: shipment.awb, status: advanceStatus }),
      });
      toast({ title: `Carrier scan applied: ${advanceStatus}`, description: `AWB ${shipment.awb}` });
      onDone();
    } catch (err) {
      toast({ title: 'Scan failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <section aria-label="Shipment" className="rounded-md border border-border p-4 space-y-3">
      <h3 className="label-caps flex items-center gap-1.5">
        <Truck className="h-3.5 w-3.5" aria-hidden /> Shipment
      </h3>

      {shipment ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="font-mono font-medium">{shipment.awb}</span>
            <span className="text-muted-foreground">· {shipment.courierName ?? shipment.provider}</span>
            <ShipmentStatusBadge status={shipment.status} />
            {shipment.trackingUrl && (
              <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2 hover:text-primary">
                Track
              </a>
            )}
          </div>

          {shipment.events && shipment.events.length > 0 && (
            <ol className="space-y-1.5 border-l border-border pl-3 text-xs text-muted-foreground">
              {shipment.events.map((ev) => (
                <li key={ev.eventId} className="relative">
                  <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-primary/60" aria-hidden />
                  <span className="font-medium text-foreground">{ev.status.replace(/_/g, ' ')}</span>
                  {ev.location ? <span> · {ev.location}</span> : null}
                  <span> · {formatDate(ev.occurredAt, true)}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Advance tracking (sim)</p>
              <Select value={advanceStatus} onValueChange={(v) => setAdvanceStatus(v as typeof advanceStatus)}>
                <SelectTrigger className="h-8 w-[180px] text-xs" aria-label="Simulated carrier scan status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                  <SelectItem value="OUT_FOR_DELIVERY">Out for Delivery</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={advancing} onClick={() => void advance()}>
              {advancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
              Apply carrier scan
            </Button>
            <p className="text-[10px] text-muted-foreground w-full sm:w-auto sm:ml-auto">
              Syncs the order FSM exactly like a real carrier webhook (Shiprocket/Delhivery sim).
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Carrier</p>
            <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
              <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Shipping provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SHIPROCKET">Shiprocket</SelectItem>
                <SelectItem value="DELHIVERY">Delhivery</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-8 text-xs" disabled={booking} onClick={() => void book()}>
            {booking ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <BookOpen className="h-3.5 w-3.5" aria-hidden />}
            Book shipment (AWB)
          </Button>
          <p className="text-[10px] text-muted-foreground w-full">
            Simulation mode issues a deterministic AWB and manifests the parcel at Surat Central Hub.
          </p>
        </div>
      )}
    </section>
  );
}

function SerialEditor({ item, onSaved }: { item: ItemRow; onSaved: () => void }) {
  const { toast } = useToast();
  const [value, setValue] = useState(() => {
    try {
      return item.serialNumbers ? (JSON.parse(item.serialNumbers) as string[]).join(', ') : '';
    } catch {
      return '';
    }
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    const serials = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setSaving(true);
    try {
      await api('/api/admin/orders/serials', {
        method: 'POST',
        body: JSON.stringify({ orderItemId: item.id, serialNumbers: serials }),
      });
      toast({ title: 'Serials saved', description: `${serials.length} serial(s) for ${item.skuCode}` });
      onSaved();
    } catch (err) {
      toast({ title: 'Failed to save serials', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <p className="font-medium text-xs">
            {item.productSlug ? (
              <a
                href={`/products/${item.productSlug}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary hover:underline underline-offset-2"
                aria-label={`Open ${item.productName} on the storefront`}
              >
                {item.productName}
              </a>
            ) : (
              item.productName
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {item.variantName} · <span className="font-mono">{item.skuCode}</span> · ×{item.quantity} · {formatINR(item.totalPrice)}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Serial numbers, comma-separated"
          className="h-8 text-xs font-mono"
          aria-label={`Serial numbers for ${item.skuCode}`}
        />
        <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

// ---------- deep-link helpers (used by the order detail sheet) ----------

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^91/, '');
  const text = encodeURIComponent('Hello from Patel Networks — regarding your order.');
  return `https://wa.me/91${digits}?text=${text}`;
}

function mapsLink(order: OrderRow): string {
  const parts = [
    order.deliveryLine1,
    order.deliveryLine2,
    order.deliveryLandmark,
    order.deliveryCity,
    order.deliveryState,
    order.deliveryPincode,
  ].filter(Boolean);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}
