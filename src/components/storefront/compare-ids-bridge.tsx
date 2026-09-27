"use client";

// CompareIdsBridge — /compare is a server-rendered page driven by ?ids=, but the
// compare selection lives in localStorage (zustand persist). Two jobs:
//   1. Hard-loaded /compare without ids + a saved selection → swap the URL to
//      ?ids=… so the server can render the table.
//   2. With ?ids= present → reconcile: drop store entries the server could not
//      resolve (stale product ids after a reseed), so the tray never shows
//      ghosts and the page never dead-ends on "nothing to compare".
// The server always re-validates ids; localStorage is only ever a hint.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCompareStore } from "@/store/compare-store";

export function CompareIdsBridge({ resolvedIds, hadIdsParam }: { resolvedIds: string[]; hadIdsParam: boolean }) {
  const router = useRouter();
  const items = useCompareStore((s) => s.items);
  const hydrated = useCompareStore((s) => s.hydrated);
  const reconcile = useCompareStore((s) => s.reconcile);

  useEffect(() => {
    if (!hydrated) return;
    if (hadIdsParam) {
      reconcile(resolvedIds);
      return;
    }
    if (items.length > 0) {
      router.replace(`/compare?ids=${items.map((i) => i.id).join(",")}`);
    }
  }, [hydrated, items, router, reconcile, resolvedIds, hadIdsParam]);

  return null;
}
