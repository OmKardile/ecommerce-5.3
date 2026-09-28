import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your Patel Networks account with your mobile number — view orders, manage addresses, track shipments and save products to your wishlist.",
};

export default function AccountLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
