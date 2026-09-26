import type { Metadata } from "next";
import { redirect } from "next/navigation";

// /login is a convenience alias — the real OTP sign-in lives at /account/login.
// Preserve any ?next= redirect target for post-login navigation.

export const metadata: Metadata = {
  title: "Sign in — Patel Networks",
  robots: { index: false, follow: true },
};

export default async function LoginAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : undefined;
  redirect(next ? `/account/login?next=${encodeURIComponent(next)}` : "/account/login");
}
