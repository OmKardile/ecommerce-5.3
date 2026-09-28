"use client";

// ADR-006 kit builder — 5-step wizard: recorder → cameras (bounded by channels) → storage →
// power & cable → summary. The sticky panel mirrors the live kit total on large screens.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Info, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCartStore } from "@/store/cart-store";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface KitVariant {
  skuId: string;
  skuCode: string;
  name: string;
  pricePaise: number;
  mrpPaise: number;
  availableStock: number;
  inStock: boolean;
  attributes: Record<string, string>;
}

export interface KitProduct {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  variants: KitVariant[];
}

export interface KitData {
  recorders: KitProduct[];
  analogCameras: KitProduct[];
  ipCameras: KitProduct[];
  hdds: KitProduct[];
  coaxCables: KitProduct[];
  ethernetCables: KitProduct[];
  bncConnector: KitVariant | null;
  rj45Connector: KitVariant | null;
  discountPct: number;
}

interface KitLineItem {
  skuId: string;
  skuCode: string;
  name: string;
  slot: string;
  qty: number;
  pricePaise: number;
  lineTotalPaise: number;
}

type RecorderType = "DVR" | "NVR";

const STEP_LABELS = ["Recorder", "Cameras", "Storage", "Power & Cable", "Summary"];

/**
 * Retention estimate (2MP assumption, continuous recording):
 * a 2MP stream writes ≈ 0.5 GB/hour → 12 GB/day per camera.
 * days ≈ (TB × 1000 GB) / (12 GB/day × cameraQty)
 */
function retentionDays(tb: number, cameras: number): number {
  if (cameras <= 0 || tb <= 0) return 0;
  return Math.round((tb * 1000) / (12 * cameras));
}

function parseChannels(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseInt(value.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseStorageTB(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function motionFade() {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.35, ease: "easeOut" as const },
  };
}

export function KitBuilderWizard({ data }: { data: KitData }) {
  const router = useRouter();
  const { toast } = useToast();
  const addToCart = useCartStore((s) => s.add);

  const [step, setStep] = useState(1);
  const [recType, setRecType] = useState<RecorderType | null>(null);
  const [recorderSkuId, setRecorderSkuId] = useState<string | null>(null);
  const [camQty, setCamQty] = useState<Record<string, number>>({});
  const [hddSkuId, setHddSkuId] = useState<string | null>(null);
  const [cableSkuId, setCableSkuId] = useState<string | null>(null);
  const [connectorOn, setConnectorOn] = useState(true);
  const [adding, setAdding] = useState(false);

  const recorderVariants = useMemo(() => data.recorders.flatMap((p) => p.variants), [data.recorders]);
  const recorderVariant = recorderVariants.find((v) => v.skuId === recorderSkuId) ?? null;
  const channels = parseChannels(recorderVariant?.attributes.Channels);
  const usedChannels = useMemo(() => Object.values(camQty).reduce((a, b) => a + b, 0), [camQty]);

  const cameraProducts = recType === "DVR" ? data.analogCameras : recType === "NVR" ? data.ipCameras : [];
  const cameraVariants = useMemo(() => cameraProducts.flatMap((p) => p.variants), [cameraProducts]);

  // When the recorder (type or capacity) changes: reset cameras to the matching family and clamp
  // quantities to the channel capacity; restore connector + clear cable of the other family.
  useEffect(() => {
    const valid = new Set(
      (recType === "DVR" ? data.analogCameras : recType === "NVR" ? data.ipCameras : []).flatMap((p) => p.variants.map((v) => v.skuId))
    );
    setCamQty((prev) => {
      const next: Record<string, number> = {};
      for (const [skuId, q] of Object.entries(prev)) {
        if (valid.has(skuId) && q > 0) next[skuId] = q;
      }
      let total = Object.values(next).reduce((a, b) => a + b, 0);
      if (channels) {
        for (const skuId of Object.keys(next).sort((a, b) => next[b] - next[a])) {
          if (total <= channels) break;
          const reduce = Math.min(total - channels, next[skuId]);
          next[skuId] -= reduce;
          total -= reduce;
          if (next[skuId] === 0) delete next[skuId];
        }
      }
      return next;
    });
    setCableSkuId(null);
    setConnectorOn(true);
  }, [recType, recorderSkuId, channels, data.analogCameras, data.ipCameras]);

  const hddVariants = useMemo(() => data.hdds.flatMap((p) => p.variants), [data.hdds]);
  const hddVariant = hddVariants.find((v) => v.skuId === hddSkuId) ?? null;

  const cableVariants = useMemo(
    () => (recType === "DVR" ? data.coaxCables : recType === "NVR" ? data.ethernetCables : []).flatMap((p) => p.variants),
    [recType, data.coaxCables, data.ethernetCables]
  );
  const cableVariant = cableVariants.find((v) => v.skuId === cableSkuId) ?? null;
  const connectorVariant = recType === "DVR" ? data.bncConnector : recType === "NVR" ? data.rj45Connector : null;

  const kitItems = useMemo<KitLineItem[]>(() => {
    const items: KitLineItem[] = [];
    if (recorderVariant) {
      items.push({
        skuId: recorderVariant.skuId,
        skuCode: recorderVariant.skuCode,
        name: recorderVariant.name,
        slot: "Recorder",
        qty: 1,
        pricePaise: recorderVariant.pricePaise,
        lineTotalPaise: recorderVariant.pricePaise,
      });
    }
    for (const [skuId, qty] of Object.entries(camQty)) {
      if (qty <= 0) continue;
      const v = cameraVariants.find((c) => c.skuId === skuId);
      if (!v) continue;
      items.push({
        skuId: v.skuId,
        skuCode: v.skuCode,
        name: v.name,
        slot: "Camera",
        qty,
        pricePaise: v.pricePaise,
        lineTotalPaise: v.pricePaise * qty,
      });
    }
    if (hddVariant) {
      items.push({
        skuId: hddVariant.skuId,
        skuCode: hddVariant.skuCode,
        name: hddVariant.name,
        slot: "Storage",
        qty: 1,
        pricePaise: hddVariant.pricePaise,
        lineTotalPaise: hddVariant.pricePaise,
      });
    }
    if (cableVariant) {
      items.push({
        skuId: cableVariant.skuId,
        skuCode: cableVariant.skuCode,
        name: cableVariant.name,
        slot: "Cable",
        qty: 1,
        pricePaise: cableVariant.pricePaise,
        lineTotalPaise: cableVariant.pricePaise,
      });
    }
    if (connectorOn && connectorVariant && recorderVariant) {
      items.push({
        skuId: connectorVariant.skuId,
        skuCode: connectorVariant.skuCode,
        name: connectorVariant.name,
        slot: "Connectors",
        qty: 1,
        pricePaise: connectorVariant.pricePaise,
        lineTotalPaise: connectorVariant.pricePaise,
      });
    }
    return items;
  }, [recorderVariant, camQty, cameraVariants, hddVariant, cableVariant, connectorOn, connectorVariant]);

  const subtotalPaise = kitItems.reduce((n, item) => n + item.lineTotalPaise, 0);
  const discountPaise = Math.floor((subtotalPaise * data.discountPct) / 100);
  const totalPaise = subtotalPaise - discountPaise;

  const kitValid = Boolean(recorderVariant) && usedChannels > 0;

  // Step gates — each step may require the previous one's anchor pick before advancing.
  const stepBlocked: string | null =
    step === 1 && !recorderVariant
      ? "Pick a recorder type and channel capacity first"
      : step === 2 && usedChannels === 0
        ? "Add at least one camera to continue"
        : null;

  function pickRecorderType(type: RecorderType) {
    setRecType(type);
    setRecorderSkuId(null);
    setHddSkuId(hddSkuId);
  }

  async function addKitToCart() {
    if (!kitValid || adding) return;
    setAdding(true);
    try {
      for (const item of kitItems) {
        const result = await addToCart(item.skuId, item.qty);
        if (!result.ok) {
          toast({
            title: `Could not add ${item.name}`,
            description: result.error ?? "Please try again or call the counter.",
            variant: "destructive",
          });
          return;
        }
      }
      toast({
        title: "Kit added to cart",
        description: `${kitItems.length} line item${kitItems.length === 1 ? "" : "s"} · ${data.discountPct}% bundle discount applied at checkout`,
      });
      router.push("/cart");
    } finally {
      setAdding(false);
    }
  }

  // ---- step renderers ----

  const capacityOptions = recType
    ? [...new Map(
        recorderVariants
          .filter((v) => (v.attributes.Type ?? "").includes(recType))
          .map((v) => [parseChannels(v.attributes.Channels), v])
      ).entries()]
        .filter(([ch]) => ch !== null)
        .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0))
    : [];

  const cameraGroups = useMemo(() => {
    const groups: { key: string; label: string; variants: KitVariant[] }[] = [];
    const order: { key: string; label: string }[] = [
      { key: "Dome", label: "Indoor · Dome" },
      { key: "Bullet", label: "Outdoor · Bullet" },
    ];
    for (const { key, label } of order) {
      const variants = cameraVariants.filter((v) => v.attributes["Form Factor"] === key);
      if (variants.length) groups.push({ key, label, variants });
    }
    const others = cameraVariants.filter((v) => !order.some((o) => o.key === v.attributes["Form Factor"]));
    if (others.length) groups.push({ key: "other", label: "Other cameras", variants: others });
    return groups;
  }, [cameraVariants]);

  const retentionCameras = usedChannels > 0 ? usedChannels : 4;
  const retentionLabel = (() => {
    if (!hddVariant) return null;
    const tb = parseStorageTB(hddVariant.attributes.Storage);
    const days = retentionDays(tb, retentionCameras);
    if (days <= 0) return null;
    return `≈ ${Math.max(1, Math.round(days * 0.75))}–${Math.round(days * 1.25)} days retention for ${retentionCameras} camera${retentionCameras === 1 ? "" : "s"} at 2MP`;
  })();

  function stepRecorder() {
    return (
      <div className="space-y-8">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { type: "DVR" as RecorderType, title: "DVR — HD Analog", desc: "Coaxial cameras (HDCVI / AHD / TVI). The value path for shops and offices." },
              { type: "NVR" as RecorderType, title: "NVR — IP PoE", desc: "Cat6 network cameras powered over Ethernet. Cleaner cabling, higher resolution." },
            ]
          ).map((opt) => {
            const selected = recType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => pickRecorderType(opt.type)}
                aria-pressed={selected}
                className={cn(
                  "rounded-lg border p-5 text-left transition-all duration-200",
                  selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-foreground/30"
                )}
              >
                <p className="font-display text-lg">{opt.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{opt.desc}</p>
              </button>
            );
          })}
        </div>

        {recType && (
          <div className="space-y-3">
            <p className="label-caps">Channel capacity</p>
            {capacityOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {capacityOptions.map(([ch, variant]) => {
                  const selected = recorderSkuId === variant.skuId;
                  const disabled = !variant.inStock;
                  return (
                    <button
                      key={variant.skuId}
                      type="button"
                      onClick={() => !disabled && setRecorderSkuId(variant.skuId)}
                      disabled={disabled}
                      aria-pressed={selected}
                      className={cn(
                        "rounded-md border px-4 py-2.5 text-[13px] font-medium transition-all",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : disabled
                            ? "cursor-not-allowed border-border bg-muted/50 text-muted-foreground/50 line-through"
                            : "border-border bg-card hover:border-foreground/40"
                      )}
                    >
                      {ch}-channel · {formatINR(variant.pricePaise)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">No {recType === "DVR" ? "DVR" : "NVR"} recorders in stock right now — try the other type.</p>
            )}
            {recorderVariant && (
              <p className="text-[13px] text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{recorderVariant.name}</span> · SKU{" "}
                <span className="font-mono text-[12px]">{recorderVariant.skuCode}</span>
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  function stepCameras() {
    if (!recorderVariant || !recType) {
      return (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-[14px] text-muted-foreground">
          Choose a recorder in step 01 first — camera options depend on analog vs IP.
        </p>
      );
    }
    const remaining = (channels ?? 0) - usedChannels;
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px]">
            <span className="font-display text-2xl">{usedChannels}</span>
            <span className="text-muted-foreground"> of {channels} channels used</span>
          </p>
          {remaining === 0 && usedChannels > 0 && (
            <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-foreground">
              <TriangleAlert className="h-4 w-4" aria-hidden />
              Channel capacity reached
            </p>
          )}
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={usedChannels} aria-valuemin={0} aria-valuemax={channels ?? 0}>
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${Math.min(100, channels ? (usedChannels / channels) * 100 : 0)}%` }} />
        </div>

        {cameraGroups.length === 0 && (
          <p className="text-[14px] text-muted-foreground">No compatible cameras listed yet — call the counter for current options.</p>
        )}

        {cameraGroups.map((group) => (
          <div key={group.key} className="space-y-3">
            <p className="label-caps">{group.label}</p>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {group.variants.map((v) => {
                const qty = camQty[v.skuId] ?? 0;
                const maxQty = Math.min(v.availableStock > 0 ? v.availableStock : 0, v.availableStock);
                const maxAddable = Math.min(maxQty, qty + Math.max(0, remaining));
                return (
                  <li key={v.skuId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium">{v.name}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        <span className="font-mono text-[11px]">{v.skuCode}</span> · {formatINR(v.pricePaise)}
                        {!v.inStock && " · out of stock"}
                      </p>
                    </div>
                    <div className="flex h-9 items-center rounded-md border border-border" role="group" aria-label={`Quantity for ${v.name}`}>
                      <button
                        type="button"
                        onClick={() => setCamQty((prev) => ({ ...prev, [v.skuId]: Math.max(0, qty - 1) }))}
                        disabled={qty <= 0}
                        aria-label={`Remove one ${v.name}`}
                        className="flex h-full w-9 items-center justify-center transition-colors hover:text-accent disabled:opacity-30"
                      >
                        –
                      </button>
                      <span className="w-9 border-x border-border text-center text-[13px] tabular-nums" aria-live="polite">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCamQty((prev) => ({ ...prev, [v.skuId]: Math.min(maxAddable, qty + 1) }))}
                        disabled={!v.inStock || remaining <= 0 || qty >= maxAddable}
                        aria-label={`Add one ${v.name}`}
                        className="flex h-full w-9 items-center justify-center transition-colors hover:text-accent disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  function stepStorage() {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setHddSkuId(null)}
            aria-pressed={hddSkuId === null}
            className={cn(
              "rounded-lg border p-5 text-left transition-all",
              hddSkuId === null ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-foreground/30"
            )}
          >
            <p className="text-[14px] font-medium">No HDD</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Recording skipped — add surveillance storage later.</p>
          </button>
          {hddVariants.map((v) => {
            const selected = hddSkuId === v.skuId;
            return (
              <button
                key={v.skuId}
                type="button"
                onClick={() => v.inStock && setHddSkuId(v.skuId)}
                disabled={!v.inStock}
                aria-pressed={selected}
                className={cn(
                  "rounded-lg border p-5 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : v.inStock
                      ? "border-border bg-card hover:border-foreground/30"
                      : "cursor-not-allowed border-border bg-muted/50 opacity-60"
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[14px] font-medium">{v.name}</p>
                  <p className="font-display text-lg">{formatINR(v.pricePaise)}</p>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  <span className="font-mono text-[11px]">{v.skuCode}</span>
                  {v.inStock ? "" : " · out of stock"}
                </p>
              </button>
            );
          })}
        </div>

        {retentionLabel && (
          <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {retentionLabel}
              {usedChannels === 0 && " (assumes 4 cameras — pick cameras to personalize this estimate)"}. Motion-based
              recording stretches retention further.
            </span>
          </p>
        )}
      </div>
    );
  }

  function stepPowerCable() {
    if (!recType) {
      return (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-[14px] text-muted-foreground">
          Choose a recorder in step 01 first — cabling depends on analog vs IP.
        </p>
      );
    }
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="label-caps">{recType === "DVR" ? "Coaxial cable roll" : "Ethernet cable roll"}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setCableSkuId(null)}
              aria-pressed={cableSkuId === null}
              className={cn(
                "rounded-lg border p-4 text-left text-[13px] transition-all",
                cableSkuId === null ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-foreground/30"
              )}
            >
              <p className="font-medium">No cable</p>
              <p className="mt-1 text-muted-foreground">Reusing existing runs</p>
            </button>
            {cableVariants.map((v) => {
              const selected = cableSkuId === v.skuId;
              const length = v.attributes.Length ?? v.name;
              return (
                <button
                  key={v.skuId}
                  type="button"
                  onClick={() => v.inStock && setCableSkuId(v.skuId)}
                  disabled={!v.inStock}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-lg border p-4 text-left text-[13px] transition-all",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : v.inStock
                        ? "border-border bg-card hover:border-foreground/30"
                        : "cursor-not-allowed border-border bg-muted/50 opacity-60"
                  )}
                >
                  <p className="font-medium">{length}</p>
                  <p className="mt-1 text-muted-foreground">
                    {formatINR(v.pricePaise)}
                    {v.inStock ? "" : " · out of stock"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {connectorVariant && (
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="connector-toggle"
                checked={connectorOn}
                onCheckedChange={(checked) => setConnectorOn(checked === true)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="connector-toggle" className="cursor-pointer text-[14px] font-medium">
                  {recType === "DVR" ? "BNC + DC connector pack" : "RJ45 termination kit"}
                </Label>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {connectorVariant.name} · <span className="font-mono text-[11px]">{connectorVariant.skuCode}</span> ·{" "}
                  {formatINR(connectorVariant.pricePaise)}
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            SMPS / power supply: sourced at the counter with your kit — our team matches the amperage
            to your final camera count at pickup. Powered PoE kits need no separate SMPS.
          </span>
        </p>
      </div>
    );
  }

  function stepSummary() {
    return (
      <div className="space-y-6">
        {kitItems.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {kitItems.map((item) => (
              <li key={item.skuId} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="label-caps !text-[10px]">{item.slot}</p>
                  <p className="mt-1 truncate text-[14px] font-medium">{item.name}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    <span className="font-mono text-[11px]">{item.skuCode}</span> · {item.qty} × {formatINR(item.pricePaise)}
                  </p>
                </div>
                <p className="shrink-0 text-[14px] font-medium tabular-nums">{formatINR(item.lineTotalPaise)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-muted-foreground">Nothing selected yet.</p>
        )}

        {!kitValid && (
          <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>A recorder and at least one camera are required before the kit can be added to cart.</span>
          </p>
        )}
      </div>
    );
  }

  const stepBodies = [stepRecorder, stepCameras, stepStorage, stepPowerCable, stepSummary];

  // ---- sticky summary panel ----

  const summaryPanel = (
    <aside aria-label="Kit summary" className="lg:sticky lg:top-24">
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="label-caps">Your kit</p>
        {kitItems.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground">Nothing selected yet — start with a recorder.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {kitItems.map((item) => (
              <li key={item.skuId} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-foreground/90">
                  {item.qty}× {item.name}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatINR(item.lineTotalPaise)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 space-y-2 border-t border-border pt-4 text-[13px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatINR(subtotalPaise)}</span>
          </div>
          {discountPaise > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bundle discount ({data.discountPct}%)</span>
              <span className="tabular-nums text-accent-foreground">−{formatINR(discountPaise)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-[14px] font-medium">Total</span>
            <span className="font-display text-2xl leading-none">{formatINR(totalPaise)}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            GST-inclusive pricing. The {data.discountPct}% kit discount is validated and applied to
            your order at checkout.
          </p>
        </div>

        <Button
          type="button"
          onClick={addKitToCart}
          disabled={!kitValid || adding}
          className="mt-5 h-11 w-full rounded-md text-sm"
        >
          {adding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Adding kit…
            </>
          ) : (
            "Add complete kit to cart"
          )}
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-12">
      <div>
        {/* Steps header */}
        <ol className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Kit builder steps">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const current = n === step;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => setStep(n)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 text-[13px] transition-colors",
                    current ? "font-medium text-foreground" : done ? "text-foreground/70" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border font-display text-[12px]",
                      current ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
                  </span>
                  <span className="hidden sm:inline">
                    {String(n).padStart(2, "0")} · {label}
                  </span>
                  <span className="sm:hidden">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="relative mt-5 h-px w-full bg-border" aria-hidden>
          <div className="absolute left-0 top-0 h-px bg-primary transition-all duration-500" style={{ width: `${((step - 1) / (STEP_LABELS.length - 1)) * 100}%` }} />
        </div>

        {/* Step body */}
        <div className="min-h-[360px] pt-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} {...motionFade()}>{stepBodies[step - 1]()}</motion.div>
          </AnimatePresence>
        </div>

        {/* Back / next */}
        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="h-10 rounded-md px-5 text-sm"
          >
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            Back
          </Button>
          {step < STEP_LABELS.length ? (
            <div className="flex items-center gap-3">
              {stepBlocked && <p className="hidden text-xs text-muted-foreground sm:block">{stepBlocked}</p>}
              <Button
                type="button"
                onClick={() => setStep((s) => Math.min(STEP_LABELS.length, s + 1))}
                disabled={Boolean(stepBlocked)}
                className="h-10 rounded-md px-5 text-sm"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={addKitToCart} disabled={!kitValid || adding} className="h-10 rounded-md px-5 text-sm">
              {adding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Adding…
                </>
              ) : (
                "Add complete kit to cart"
              )}
            </Button>
          )}
        </div>
      </div>

      {summaryPanel}
    </div>
  );
}
