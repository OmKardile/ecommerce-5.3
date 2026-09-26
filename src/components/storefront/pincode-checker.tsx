"use client";

// Delivery & COD availability checker — GET /api/shipping/pincode, with localStorage cache of the last pin.

import { useCallback, useEffect, useState } from "react";
import { MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidPincode } from "@/lib/pincodes";

interface PincodeResult {
  pin: string;
  zone: string;
  label: string;
  etaDays: string;
  codAvailable: boolean;
  express: boolean;
  estimatedDelivery: string;
}

const PIN_STORAGE_KEY = "pn_last_pin";

function formatEtaDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function PincodeChecker() {
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<PincodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!isValidPincode(trimmed)) {
      setError("Enter a valid 6-digit Indian PIN code.");
      setResult(null);
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipping/pincode?pin=${encodeURIComponent(trimmed)}`);
      const json = (await res.json()) as { ok: boolean; data?: PincodeResult; error?: string };
      if (json.ok && json.data) {
        setResult(json.data);
        setError(null);
        try {
          localStorage.setItem(PIN_STORAGE_KEY, trimmed);
        } catch {
          /* storage unavailable — non-fatal */
        }
      } else {
        setResult(null);
        setError(json.error ?? "Could not check serviceability. Try again.");
      }
    } catch {
      setResult(null);
      setError("Network error — could not check serviceability.");
    } finally {
      setChecking(false);
    }
  }, []);

  // Prefill the last pin used and check it silently
  useEffect(() => {
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(PIN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (cached && isValidPincode(cached)) {
      setPin(cached);
      void check(cached);
    }
  }, [check]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void check(pin);
  }

  return (
    <section aria-label="Delivery availability check" className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="label-caps flex items-center gap-1.5">
        <Truck className="h-3.5 w-3.5" aria-hidden />
        Delivery &amp; COD
      </p>

      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
        <Input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="Enter 6-digit PIN"
          inputMode="numeric"
          autoComplete="postal-code"
          aria-label="PIN code"
          aria-invalid={Boolean(error)}
          className="h-9 max-w-[180px] rounded-md bg-card text-[13px] tabular-nums"
        />
        <Button type="submit" variant="outline" size="sm" disabled={checking} className="h-9 rounded-md px-4 text-xs">
          {checking ? "Checking…" : "Check"}
        </Button>
      </form>

      {error && (
        <p className="mt-2.5 text-[13px] text-destructive" role="alert">
          {error}
        </p>
      )}

      {result && !error && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-[13px]">
          <p className="flex items-center gap-1.5 font-medium">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            {result.label}
          </p>
          <p className="text-muted-foreground">
            Delivery in {result.etaDays}
            {formatEtaDate(result.estimatedDelivery) ? <> by {formatEtaDate(result.estimatedDelivery)}</> : null}.
          </p>
          <p className={result.codAvailable ? "text-primary" : "text-accent-foreground"}>
            {result.codAvailable ? "Cash on Delivery available" : "Prepaid only in this zone"}
          </p>
        </div>
      )}
    </section>
  );
}
