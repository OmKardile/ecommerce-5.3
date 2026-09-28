import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track Your Order",
  description:
    "Track your Patel Networks order with just your phone number — live shipment status, delivery updates and return progress. No order number needed.",
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
