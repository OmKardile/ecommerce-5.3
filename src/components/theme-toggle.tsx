"use client";

// ThemeToggle — manual light/dark switch (next-themes, class strategy).
// Light is the brand-default editorial theme; dark is the trust-pine night
// theme defined in globals.css (.dark). The icon is mounted-gated so SSR and
// the first client render agree (no hydration mismatch, no icon flicker).

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // Mount gate without setState-in-effect (lint rule react-hooks/set-state-in-effect):
  // SSR renders false, every client render after hydration renders true.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </Button>
  );
}
