import type { Metadata } from "next";
import { CartView } from "@/components/storefront/cart-view";

export const metadata: Metadata = {
  title: "Your Cart",
  description: "Review your surveillance & networking hardware before checkout.",
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-8 lg:mb-10">
        <p className="label-caps mb-2">Step 1 of 3 · Review</p>
        <h1 className="font-display text-3xl sm:text-4xl">Your cart</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Prices are GST-inclusive. Stock is reserved for you the moment the order is placed.
        </p>
      </header>
      <CartView />
    </div>
  );
}
