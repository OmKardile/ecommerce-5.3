"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-20">
      <div className="max-w-lg text-center">
        <p className="label-caps">Something interrupted the connection</p>
        <h1 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">A fault was detected on this screen.</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Your session and cart are unaffected. Retry the action or return to the store front.
          {error.digest ? <span className="mt-2 block text-xs text-muted-foreground/70">Ref: {error.digest}</span> : null}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button onClick={reset} className="rounded-full px-6">
            Try again
          </Button>
          <Button asChild variant="outline" className="rounded-full px-6">
            <a href="/">Go home</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
