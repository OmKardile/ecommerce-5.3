// Shared status badge mappers for the ops console (muted, non-neon palette).

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS, type OrderStatus } from '@/lib/constants';

const ORDER_BADGE_CLASS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-stone-200/70 text-stone-800 border-stone-300 dark:bg-stone-800/50 dark:text-stone-300 dark:border-stone-700',
  COD_PENDING: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
  PAID: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900',
  CONFIRMED: 'bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900',
  PROCESSING: 'bg-orange-100 text-orange-900 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900',
  PACKED: 'bg-yellow-100 text-yellow-900 border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-900',
  SHIPPED: 'bg-[#e7ede9] text-[#1a3c34] border-[#c8d6cf] dark:bg-[#1e332c] dark:text-[#a9d0c0] dark:border-[#2e4a3f]',
  OUT_FOR_DELIVERY: 'bg-[#f3e8d3] text-[#7c4a03] border-[#e3d0a8] dark:bg-[#33270f] dark:text-[#d9b06a] dark:border-[#4d3c1c]',
  DELIVERED: 'bg-green-100 text-green-900 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-900',
  CANCELLED: 'bg-red-100 text-red-900 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900',
  RETURN_REQUESTED: 'bg-orange-100 text-orange-900 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900',
  RETURNED: 'bg-stone-200/70 text-stone-800 border-stone-300 dark:bg-stone-800/50 dark:text-stone-300 dark:border-stone-700',
  REFUNDED: 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800/50 dark:text-stone-400 dark:border-stone-700',
};

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const label = ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium whitespace-nowrap', ORDER_BADGE_CLASS[status] ?? 'bg-muted text-muted-foreground', className)}>
      {label}
    </Badge>
  );
}

const SHIPMENT_BADGE_CLASS: Record<string, string> = {
  MANIFESTED: 'bg-stone-200/70 text-stone-800 border-stone-300 dark:bg-stone-800/50 dark:text-stone-300 dark:border-stone-700',
  PICKED_UP: 'bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900',
  IN_TRANSIT: 'bg-[#e7ede9] text-[#1a3c34] border-[#c8d6cf] dark:bg-[#1e332c] dark:text-[#a9d0c0] dark:border-[#2e4a3f]',
  OUT_FOR_DELIVERY: 'bg-[#f3e8d3] text-[#7c4a03] border-[#e3d0a8] dark:bg-[#33270f] dark:text-[#d9b06a] dark:border-[#4d3c1c]',
  DELIVERED: 'bg-green-100 text-green-900 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-900',
  RTO_INITIATED: 'bg-red-100 text-red-900 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900',
  RTO_DELIVERED: 'bg-stone-200/70 text-stone-800 border-stone-300 dark:bg-stone-800/50 dark:text-stone-300 dark:border-stone-700',
  CANCELLED: 'bg-red-100 text-red-900 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900',
};

const SHIPMENT_LABELS: Record<string, string> = {
  MANIFESTED: 'Manifested',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  RTO_INITIATED: 'RTO Initiated',
  RTO_DELIVERED: 'RTO Delivered',
  CANCELLED: 'Cancelled',
};

export function ShipmentStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium whitespace-nowrap', SHIPMENT_BADGE_CLASS[status] ?? 'bg-muted text-muted-foreground', className)}>
      {SHIPMENT_LABELS[status] ?? status}
    </Badge>
  );
}

const MOVEMENT_BADGE_CLASS: Record<string, string> = {
  PURCHASE_RECEIPT: 'bg-green-100 text-green-900 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-900',
  ORDER_RESERVED: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
  ORDER_DISPATCHED: 'bg-[#e7ede9] text-[#1a3c34] border-[#c8d6cf] dark:bg-[#1e332c] dark:text-[#a9d0c0] dark:border-[#2e4a3f]',
  ORDER_CANCELLED_RESTOCK: 'bg-stone-200/70 text-stone-800 border-stone-300 dark:bg-stone-800/50 dark:text-stone-300 dark:border-stone-700',
  RETURN_RESTOCK: 'bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900',
  MANUAL_ADJUSTMENT: 'bg-orange-100 text-orange-900 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900',
  DAMAGED_WRITE_OFF: 'bg-red-100 text-red-900 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900',
};

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_RECEIPT: 'Purchase Receipt',
  ORDER_RESERVED: 'Order Reserved',
  ORDER_DISPATCHED: 'Order Dispatched',
  ORDER_CANCELLED_RESTOCK: 'Cancel Restock',
  RETURN_RESTOCK: 'Return Restock',
  MANUAL_ADJUSTMENT: 'Manual Adjustment',
  DAMAGED_WRITE_OFF: 'Damaged Write-off',
};

export function MovementReasonBadge({ reason, className }: { reason: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium whitespace-nowrap', MOVEMENT_BADGE_CLASS[reason] ?? 'bg-muted text-muted-foreground', className)}>
      {MOVEMENT_LABELS[reason] ?? reason}
    </Badge>
  );
}

/** Allowed next statuses from the strict FSM — used to render transition action buttons. */
export function allowedNextStatuses(current: string): OrderStatus[] {
  return ORDER_TRANSITIONS[current as OrderStatus] ?? [];
}
