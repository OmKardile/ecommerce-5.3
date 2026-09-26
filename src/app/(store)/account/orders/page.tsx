import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, PackageOpen } from "lucide-react";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "My Orders",
  description: "Your Patel Networks order history with invoices and tracking.",
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "DELIVERED":
      return "border-primary/40 text-primary";
    case "CANCELLED":
      return "border-destructive/40 text-destructive";
    case "PENDING_PAYMENT":
      return "border-accent/50 text-accent-foreground";
    default:
      return "";
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

export default async function AccountOrdersPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login?next=%2Faccount%2Forders");

  const orders = await db.order.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: { items: { take: 2 }, payments: true, _count: { select: { items: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-8">
        <p className="label-caps mb-2">Your account</p>
        <h1 className="font-display text-3xl sm:text-4xl">Orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">Invoices, tracking and live status — everything per order, in one place.</p>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <PackageOpen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 font-display text-2xl">No orders yet.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            When you place an order it appears here with its GST invoice, courier tracking and warranty serials.
          </p>
          <Button asChild className="mt-6 h-10">
            <Link href="/products">Browse the catalogue</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4" aria-label="Order history">
          {orders.map((order) => {
            const payment = order.payments[order.payments.length - 1];
            const paid = payment?.status === "SUCCESS" || ["PAID", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status);
            return (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="group block rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-display text-lg font-semibold">{order.orderNumber}</span>
                        <Badge variant="outline" className={statusBadgeClass(order.status)}>
                          {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                        </Badge>
                        {order.isB2B && (
                          <Badge variant="outline" className="text-[10px]">
                            B2B
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(order.createdAt)} · {order.paymentMethod === "COD" ? "Cash on Delivery" : "Razorpay"} ·{" "}
                        {paid ? "paid" : "payment pending"}
                      </p>
                      <p className="mt-2 truncate text-sm text-muted-foreground">
                        {order.items.map((i) => `${i.productName} × ${i.quantity}`).join(", ")}
                        {order._count.items > order.items.length ? `, +${order._count.items - order.items.length} more` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-display text-xl">{formatINR(order.totalAmount)}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
