"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldCheck, Truck, FileText } from "lucide-react";
import { OTPLogin } from "@/components/storefront/otp-login";

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") ?? "/account";
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!cancelled && res.ok) setHasSession(true);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hasSession) {
      router.replace(next.startsWith("/") ? next : "/account");
    }
  }, [hasSession, next, router]);

  if (checkingSession) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (hasSession) {
    return (
      <div className="mx-auto max-w-md py-10 text-center text-sm text-muted-foreground" aria-busy="true">
        You are already signed in — taking you to your account…
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="lg:col-span-7">
        <header className="mb-8">
          <p className="label-caps mb-2">Account access</p>
          <h1 className="font-display text-3xl sm:text-4xl">Sign in or create your account</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            One mobile number, one code — that is the whole login. Your cart follows you across devices,
            every order ships with a GST invoice, and warranty is tracked against the serial numbers we scan at dispatch.
          </p>
        </header>

        <OTPLogin redirectTo={next.startsWith("/") ? next : "/account"} />

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="link-underline text-foreground">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" className="link-underline text-foreground">
            privacy policy
          </Link>
          . Contractor? Your GSTIN is captured at checkout, never shared.
        </p>
      </div>

      <aside className="lg:col-span-5" aria-label="Why sign in">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-display text-lg">Built for installers</h2>
          <ul className="mt-4 space-y-4 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium text-foreground">Same-day dispatch</span> on confirmed orders before 4:00 PM IST — Surat hub covers Gujarat next-day.
              </span>
            </li>
            <li className="flex gap-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium text-foreground">Printable GST invoices</span> with CGST/SGST or IGST split per line — input-tax-credit ready.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium text-foreground">Serial-tracked warranty</span> on genuine Hikvision, Dahua, CP Plus and D-Link stock.
              </span>
            </li>
          </ul>
          <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            Prefer to talk first? Call{" "}
            <a href="tel:+919876543210" className="link-underline font-medium text-foreground">
              +91 98765 43210
            </a>{" "}
            or read{" "}
            <Link href="/about" className="link-underline font-medium text-foreground">
              about Patel Networks
            </Link>
            .
          </p>
        </div>
      </aside>
    </div>
  );
}

export default function AccountLoginPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <Suspense
        fallback={
          <div className="mx-auto max-w-md space-y-4 py-10" aria-busy="true">
            <div className="h-6 w-40 animate-pulse rounded bg-muted" />
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          </div>
        }
      >
        <LoginInner />
      </Suspense>
    </div>
  );
}
