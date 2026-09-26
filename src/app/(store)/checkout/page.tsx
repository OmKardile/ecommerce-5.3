import type { Metadata } from "next";
import { CheckoutView } from "@/components/storefront/checkout-view";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Delivery details, GST invoice options and secure payment for your Patel Networks order.",
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-8 lg:mb-10">
        <p className="label-caps mb-2">Step 2 of 3 · Details & payment</p>
        <h1 className="font-display text-3xl sm:text-4xl">Checkout</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          GST invoices are issued for every order. Stock is reserved the moment you place the order.
        </p>
      </header>
      <CheckoutView />
    </div>
  );
}
