"use client";

// Checkout view — delivery details, B2B GSTIN capture, coupon, payment method,
// sticky summary and order placement (idempotent). Guests get an inline OTP sign-in
// so the cart context is never lost.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Landmark,
  Loader2,
  MapPin,
  Truck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCartStore } from "@/store/cart-store";
import { formatINR } from "@/lib/money";
import { localPhoneFromInput } from "@/lib/phone";
import { COD_FEE_PAISE, DEFAULT_SHIPPING_FEE_PAISE, FREE_SHIPPING_THRESHOLD_PAISE } from "@/lib/constants";
import { CartCouponBox, clearAppliedCoupon, readAppliedCoupon, type AppliedCoupon } from "@/components/storefront/cart-coupon-box";
import { OTPLogin } from "@/components/storefront/otp-login";
import { PayNowButton } from "@/components/storefront/checkout-pay-now-button";
import { toast } from "@/hooks/use-toast";

interface SavedAddress {
  id: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  type: string;
}

interface AuthMe {
  userId: string;
  phone: string;
  fullName: string | null;
  companyName: string | null;
  gstin: string | null;
  addresses: SavedAddress[];
}

interface PinInfo {
  zone: string;
  label: string;
  etaDays: string;
  codAvailable: boolean;
}

interface PlacedOrder {
  orderId: string;
  orderNumber: string;
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PIN_RE = /^[1-9][0-9]{5}$/;

const emptyForm = {
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};

export function CheckoutView() {
  const router = useRouter();
  const cart = useCartStore((s) => s.cart);
  const loaded = useCartStore((s) => s.loaded);
  const refreshCart = useCartStore((s) => s.refresh);

  const [phase, setPhase] = useState<"loading" | "anonymous" | "ready">("loading");
  const [me, setMe] = useState<AuthMe | null>(null);
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [form, setForm] = useState(emptyForm);
  const [saveAddress, setSaveAddress] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [pinInfo, setPinInfo] = useState<{ pin: string; info: PinInfo } | null>(null);
  const [pinChecking, setPinChecking] = useState(false);

  const [isB2B, setIsB2B] = useState(false);
  const [b2bCompany, setB2bCompany] = useState("");
  const [b2bGstin, setB2bGstin] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"RAZORPAY" | "COD">("RAZORPAY");
  const [cartCod, setCartCod] = useState<{ eligible: boolean; reason?: string } | null>(null);

  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [customerNote, setCustomerNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const idempotencyKey = useRef<string>("");

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.status === 401) {
        setPhase("anonymous");
        return;
      }
      const json = (await res.json()) as { ok: boolean; data?: AuthMe };
      if (json.ok && json.data) {
        setMe(json.data);
        const addresses = json.data.addresses ?? [];
        const preferred = addresses.find((a) => a.isDefault) ?? addresses[0];
        if (preferred) {
          setSelectedId(preferred.id);
          setSaveAddress(false);
        } else {
          setSelectedId("new");
          setSaveAddress(true);
        }
        if (json.data.gstin) {
          setIsB2B(true);
          setB2bGstin(json.data.gstin);
          setB2bCompany(json.data.companyName ?? "");
        }
        setPhase("ready");
      } else {
        setPhase("anonymous");
      }
    } catch {
      setPhase("anonymous");
    }
  }, []);

  useEffect(() => {
    void loadMe();
    if (!loaded) void refreshCart();
    void Promise.resolve().then(() => setApplied(readAppliedCoupon()));
    idempotencyKey.current = crypto.randomUUID();
  }, []);

  // COD envelope from /api/cart
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/cart", { cache: "no-store" });
        const json = (await res.json()) as { ok: boolean; data?: { cod?: { eligible: boolean; reason?: string } } };
        if (!cancelled && json.ok && json.data?.cod) setCartCod(json.data.cod);
      } catch {
        // non-fatal hint
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cart.itemCount, cart.subtotalPaise]);

  async function checkPincode(pin: string) {
    if (!PIN_RE.test(pin)) return;
    setPinChecking(true);
    try {
      const res = await fetch(`/api/shipping/pincode?pin=${encodeURIComponent(pin)}`);
      const json = (await res.json()) as { ok: boolean; data?: PinInfo };
      if (json.ok && json.data) setPinInfo({ pin, info: json.data });
      else setPinInfo({ pin, info: { zone: "UNKNOWN", label: "Unknown zone", etaDays: "unavailable", codAvailable: true } });
    } catch {
      setPinInfo({ pin, info: { zone: "UNKNOWN", label: "Unknown zone", etaDays: "unavailable", codAvailable: true } });
    } finally {
      setPinChecking(false);
    }
  }

  const selectedAddress = useMemo(
    () => me?.addresses.find((a) => a.id === selectedId) ?? null,
    [me, selectedId]
  );

  const delivery = useMemo(() => {
    if (selectedAddress) {
      return {
        recipientName: selectedAddress.recipientName,
        phone: selectedAddress.phone,
        addressLine1: selectedAddress.addressLine1,
        addressLine2: selectedAddress.addressLine2 ?? "",
        landmark: selectedAddress.landmark ?? "",
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
      };
    }
    return form;
  }, [selectedAddress, form]);

  const pin = delivery.pincode;
  const activePinInfo = pinInfo?.pin === pin ? pinInfo.info : null;

  useEffect(() => {
    if (PIN_RE.test(pin)) void checkPincode(pin);
  }, [pin]);

  const codBlocked = Boolean(
    (cartCod && !cartCod.eligible) || (activePinInfo && !activePinInfo.codAvailable)
  );
  const codReason = cartCod && !cartCod.eligible
    ? cartCod.reason
    : activePinInfo && !activePinInfo.codAvailable
      ? "COD is not serviceable at this PIN (air-cargo zone)."
      : null;

  const shippingFee = useMemo(() => {
    const base = cart.subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : DEFAULT_SHIPPING_FEE_PAISE;
    if (activePinInfo?.zone === "SPECIAL") return Math.max(base, 19900);
    return base;
  }, [cart.subtotalPaise, activePinInfo]);

  const discount = applied?.discountPaise ?? 0;
  const bundleDiscount = cart.bundleDiscountPaise;
  const total = Math.max(cart.subtotalPaise - bundleDiscount - discount, 0) + shippingFee + (paymentMethod === "COD" ? COD_FEE_PAISE : 0);

  function setField(key: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => ({ ...e, [key]: "" }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!selectedAddress) {
      if (form.recipientName.trim().length < 2) errors.recipientName = "Recipient name is required.";
      if (!/^(\+91)?[6-9]\d{9}$/.test(form.phone.replace(/[\s-]/g, ""))) errors.phone = "Enter a valid 10-digit mobile number.";
      if (form.addressLine1.trim().length < 5) errors.addressLine1 = "Address line 1 is required.";
      if (form.city.trim().length < 2) errors.city = "City is required.";
      if (form.state.trim().length < 2) errors.state = "State is required.";
      if (!PIN_RE.test(form.pincode)) errors.pincode = "Enter a valid 6-digit PIN code.";
    }
    if (isB2B) {
      if (b2bCompany.trim().length < 2) errors.companyName = "Legal business name is required for input tax credit.";
      if (!GSTIN_RE.test(b2bGstin.toUpperCase())) errors.gstin = "Enter the 15-character GSTIN exactly as registered.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function placeOrder() {
    if (placing || placed) return;
    if (cart.lines.length === 0 || cart.hasOutOfStock) return;
    if (!validate()) {
      toast({ title: "Check the highlighted fields", variant: "destructive" });
      return;
    }
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          delivery,
          saveAddress: !selectedAddress && saveAddress,
          isB2B,
          companyName: isB2B ? b2bCompany.trim() : undefined,
          gstin: isB2B ? b2bGstin.toUpperCase() : undefined,
          couponCode: applied?.code,
          customerNote: customerNote.trim() || undefined,
          idempotencyKey: idempotencyKey.current || (idempotencyKey.current = crypto.randomUUID()),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        code?: string;
        data?: { orderId: string; orderNumber: string; status: string; paymentMethod: string };
      };
      if (!json.ok || !json.data) {
        const msg = json.error ?? "Could not place the order.";
        toast({
          title: json.code === "COUPON_INVALID" ? "Coupon rejected" : "Order failed",
          description: json.code === "COUPON_INVALID" ? `${msg} Remove the coupon and retry.` : msg,
          variant: "destructive",
        });
        if (json.code === "COUPON_INVALID") {
          clearAppliedCoupon();
          setApplied(null);
        }
        return;
      }

      await refreshCart();

      if (json.data.paymentMethod === "COD") {
        clearAppliedCoupon();
        toast({ title: "Order placed", description: `Order ${json.data.orderNumber} confirmed — pay on delivery.` });
        router.push(`/order-success/${json.data.orderNumber}`);
        router.refresh();
        return;
      }

      // RAZORPAY — keep the same idempotency key for safe retries, open the gateway
      setPlaced({ orderId: json.data.orderId, orderNumber: json.data.orderNumber });
    } catch {
      toast({ title: "Network error", description: "Could not reach the server. Retry in a moment.", variant: "destructive" });
    } finally {
      setPlacing(false);
    }
  }

  // ---------- render ----------

  if (phase === "loading") {
    return (
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7 xl:col-span-8">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  if (phase === "anonymous") {
    return (
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <p className="label-caps mb-2">Secure checkout</p>
          <h2 className="font-display text-2xl sm:text-3xl">Sign in to place your order</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your cart ({cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}) is saved — it stays right here while you verify your number.
          </p>
        </div>
        <OTPLogin compact onSuccess={() => void loadMe()} />
      </div>
    );
  }

  if (loaded && cart.lines.length === 0 && !placed) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center sm:py-20">
        <p className="label-caps mb-4">Checkout</p>
        <h2 className="font-display text-3xl">Your cart is empty.</h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
          Add cameras, recorders or cabling to the cart and return here — checkout keeps everything reserved for you.
        </p>
        <Button asChild className="mt-8 h-11 px-6">
          <Link href="/products">
            Browse the catalogue <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center sm:py-16">
        <p className="label-caps mb-3">Order {placed.orderNumber} · pending payment</p>
        <h2 className="font-display text-3xl">Finish your payment</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          The order is reserved but not confirmed until the payment is captured. The sandbox dialog should have opened — you can also retry below.
        </p>
        <div className="mt-8 flex justify-center">
          <PayNowButton
            orderId={placed.orderId}
            orderNumber={placed.orderNumber}
            amountPaise={total}
            label="Open payment"
            autoOpen
          />
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          You can also complete the payment later from <Link href="/account/orders" className="link-underline text-foreground">Account → Orders</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
      <div className="space-y-6 lg:col-span-7 xl:col-span-8">
        {/* a) delivery details */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          aria-labelledby="delivery-heading"
          className="rounded-lg border border-border bg-card p-5 sm:p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" aria-hidden />
            <h2 id="delivery-heading" className="font-display text-lg">
              Delivery details
            </h2>
          </div>

          {me && me.addresses.length > 0 && (
            <RadioGroup
              value={selectedId}
              onValueChange={(v) => setSelectedId(v as string | "new")}
              className="mb-4 space-y-3"
              aria-label="Saved addresses"
            >
              {me.addresses.map((a) => (
                <Label
                  key={a.id}
                  htmlFor={`addr-${a.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3.5 transition-colors hover:bg-muted/50 has-[button[data-state=checked]]:border-primary"
                >
                  <RadioGroupItem id={`addr-${a.id}`} value={a.id} className="mt-0.5" />
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">
                      {a.recipientName}
                      {a.isDefault && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Default</span>}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {a.addressLine1}
                      {a.addressLine2 ? `, ${a.addressLine2}` : ""}
                      {a.landmark ? ` · ${a.landmark}` : ""}, {a.city}, {a.state} — {a.pincode}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">+91 {a.phone.replace(/\D/g, "").slice(-10)}</span>
                  </span>
                </Label>
              ))}
              <Label
                htmlFor="addr-new"
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background p-3.5 transition-colors hover:bg-muted/50 has-[button[data-state=checked]]:border-primary"
              >
                <RadioGroupItem id="addr-new" value="new" />
                <span className="text-sm font-medium">Deliver to a new address</span>
              </Label>
            </RadioGroup>
          )}

          {(!me || me.addresses.length === 0 || selectedId === "new") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <Label htmlFor="f-name" className="label-caps mb-1.5 block">Recipient name</Label>
                <Input id="f-name" value={form.recipientName} onChange={(e) => setField("recipientName", e.target.value)} className="h-10" autoComplete="name" aria-invalid={Boolean(formErrors.recipientName)} />
                {formErrors.recipientName && <p role="alert" className="mt-1 text-xs text-destructive">{formErrors.recipientName}</p>}
              </div>
              <div>
                <Label htmlFor="f-phone" className="label-caps mb-1.5 block">Mobile number</Label>
                <div className="flex gap-2">
                  <span className="flex h-10 shrink-0 items-center rounded-md border border-border bg-muted px-3 font-mono text-sm text-muted-foreground">+91</span>
                  <Input id="f-phone" inputMode="numeric" value={form.phone} onChange={(e) => setField("phone", localPhoneFromInput(e.target.value))} className="h-10" autoComplete="tel-national" aria-invalid={Boolean(formErrors.phone)} />
                </div>
                {formErrors.phone && <p role="alert" className="mt-1 text-xs text-destructive">{formErrors.phone}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="f-line1" className="label-caps mb-1.5 block">Address line 1</Label>
                <Input id="f-line1" value={form.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)} placeholder="House / shop no, building, street" className="h-10" autoComplete="address-line1" aria-invalid={Boolean(formErrors.addressLine1)} />
                {formErrors.addressLine1 && <p role="alert" className="mt-1 text-xs text-destructive">{formErrors.addressLine1}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="f-line2" className="label-caps mb-1.5 block">Address line 2 <span className="normal-case text-muted-foreground/70">(optional)</span></Label>
                <Input id="f-line2" value={form.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)} className="h-10" autoComplete="address-line2" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="f-landmark" className="label-caps mb-1.5 block">Landmark <span className="normal-case text-muted-foreground/70">(optional)</span></Label>
                <Input id="f-landmark" value={form.landmark} onChange={(e) => setField("landmark", e.target.value)} className="h-10" />
              </div>
              <div>
                <Label htmlFor="f-city" className="label-caps mb-1.5 block">City</Label>
                <Input id="f-city" value={form.city} onChange={(e) => setField("city", e.target.value)} className="h-10" autoComplete="address-level2" aria-invalid={Boolean(formErrors.city)} />
                {formErrors.city && <p role="alert" className="mt-1 text-xs text-destructive">{formErrors.city}</p>}
              </div>
              <div>
                <Label htmlFor="f-state" className="label-caps mb-1.5 block">State</Label>
                <Input id="f-state" value={form.state} onChange={(e) => setField("state", e.target.value)} className="h-10" autoComplete="address-level1" aria-invalid={Boolean(formErrors.state)} />
                {formErrors.state && <p role="alert" className="mt-1 text-xs text-destructive">{formErrors.state}</p>}
              </div>
              <div>
                <Label htmlFor="f-pin" className="label-caps mb-1.5 block">PIN code</Label>
                <Input
                  id="f-pin"
                  inputMode="numeric"
                  value={form.pincode}
                  onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onBlur={(e) => void checkPincode(e.target.value)}
                  className="h-10"
                  autoComplete="postal-code"
                  aria-invalid={Boolean(formErrors.pincode)}
                />
                {formErrors.pincode && <p role="alert" className="mt-1 text-xs text-destructive">{formErrors.pincode}</p>}
              </div>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="h-4 w-4 accent-[#1a3c34]"
                  />
                  Save to my address book
                </label>
              </div>
            </div>
          )}

          {/* ETA + COD serviceability for the chosen PIN */}
          {pin && PIN_RE.test(pin) && (
            <div aria-live="polite" className="mt-4 rounded-lg border border-border bg-muted/50 px-3.5 py-3 text-xs">
              {pinChecking ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking delivery at {pin}…
                </p>
              ) : activePinInfo ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Truck className="h-3.5 w-3.5 text-primary" aria-hidden /> {activePinInfo.label} — {activePinInfo.etaDays}
                  </span>
                  <span className={activePinInfo.codAvailable ? "text-muted-foreground" : "font-medium text-destructive"}>
                    {activePinInfo.codAvailable ? "COD available at this PIN" : "Prepaid only at this PIN (air-cargo zone)"}
                  </span>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden /> This PIN could not be verified — double-check it.
                </p>
              )}
            </div>
          )}
        </motion.section>

        {/* b) B2B */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
          aria-labelledby="b2b-heading"
          className="rounded-lg border border-border bg-card p-5 sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
              <div>
                <h2 id="b2b-heading" className="font-display text-lg">Use GSTIN for business input tax credit</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  The invoice will carry your GSTIN so your contractor can claim the credit. CGST/SGST splits are printed per line.
                </p>
              </div>
            </div>
            <Switch checked={isB2B} onCheckedChange={setIsB2B} aria-label="Business purchase (GST invoice)" />
          </div>
          {isB2B && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="b2b-company" className="label-caps mb-1.5 block">Legal business name</Label>
                <Input id="b2b-company" value={b2bCompany} onChange={(e) => setB2bCompany(e.target.value)} className="h-10" aria-invalid={Boolean(formErrors.companyName)} />
                {formErrors.companyName && <p role="alert" className="mt-1 text-xs text-destructive">{formErrors.companyName}</p>}
              </div>
              <div>
                <Label htmlFor="b2b-gstin" className="label-caps mb-1.5 block">GSTIN (15 characters)</Label>
                <Input
                  id="b2b-gstin"
                  value={b2bGstin}
                  onChange={(e) => {
                    setB2bGstin(e.target.value.toUpperCase().slice(0, 15));
                    setFormErrors((er) => ({ ...er, gstin: "" }));
                  }}
                  className="h-10 font-mono uppercase"
                  placeholder="24AAACP1234F1Z8"
                  aria-invalid={Boolean(formErrors.gstin)}
                />
                {formErrors.gstin && <p role="alert" className="mt-1 text-xs text-destructive">{formErrors.gstin}</p>}
                {b2bGstin.length === 15 && !GSTIN_RE.test(b2bGstin) && (
                  <p className="mt-1 text-xs text-muted-foreground">Format looks off — GSTIN is 2 digits + 10-char PAN + entity + Z + checksum.</p>
                )}
              </div>
            </div>
          )}
        </motion.section>

        {/* d) payment method */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          aria-labelledby="payment-heading"
          className="rounded-lg border border-border bg-card p-5 sm:p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" aria-hidden />
            <h2 id="payment-heading" className="font-display text-lg">Payment method</h2>
          </div>
          <RadioGroup
            value={paymentMethod}
            onValueChange={(v) => setPaymentMethod(v as "RAZORPAY" | "COD")}
            className="space-y-3"
            aria-label="Payment method"
          >
            <Label
              htmlFor="pay-online"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/50 has-[button[data-state=checked]]:border-primary"
            >
              <RadioGroupItem id="pay-online" value="RAZORPAY" className="mt-0.5" />
              <span className="text-sm">
                <span className="block font-medium">Pay online — Razorpay</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">UPI, cards and netbanking via Razorpay. Order confirms instantly.</span>
              </span>
            </Label>
            <Label
              htmlFor="pay-cod"
              className={
                codBlocked
                  ? "flex cursor-not-allowed items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 opacity-70"
                  : "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/50 has-[button[data-state=checked]]:border-primary"
              }
            >
              <RadioGroupItem id="pay-cod" value="COD" disabled={codBlocked} className="mt-0.5" />
              <span className="text-sm">
                <span className="block font-medium">Cash on Delivery <span className="font-normal text-muted-foreground">(+ {formatINR(COD_FEE_PAISE)} fee)</span></span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {codBlocked && codReason
                    ? `Unavailable — ${codReason}`
                    : "Pay the courier by cash/UPI on arrival. Available up to ₹15,000 per order."}
                </span>
              </span>
            </Label>
          </RadioGroup>

          <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="font-medium text-foreground">Standard surface</span>
              {activePinInfo ? ` — ${activePinInfo.label}, ${activePinInfo.etaDays}.` : " — pick your PIN above for a firm ETA."} Orders confirmed before 4:00 PM IST dispatch the same day.
            </p>
          </div>

          <div className="mt-4">
            <Label htmlFor="f-note" className="label-caps mb-1.5 block">Order note <span className="normal-case text-muted-foreground/70">(optional)</span></Label>
            <Textarea id="f-note" value={customerNote} onChange={(e) => setCustomerNote(e.target.value.slice(0, 500))} rows={2} placeholder="Gate code, preferred delivery window, installer instructions…" className="resize-none text-sm" />
          </div>
        </motion.section>
      </div>

      {/* e/f) summary */}
      <aside className="lg:col-span-5 xl:col-span-4" aria-label="Order summary">
        <div className="lg:sticky lg:top-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
            className="rounded-lg border border-border bg-card p-6"
          >
            <h2 className="font-display text-xl">Order summary</h2>

            <ul className="thin-scrollbar mt-4 max-h-56 space-y-3 overflow-y-auto pr-1">
              {cart.lines.map((l) => (
                <li key={l.skuId} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{l.productName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {l.variantName} × {l.quantity}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-medium">{formatINR(l.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-border pt-4">
              <CartCouponBox subtotalPaise={cart.subtotalPaise} applied={applied} onChange={setApplied} />
            </div>

            <div className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal ({cart.itemCount} {cart.itemCount === 1 ? "item" : "items"})</span>
                <span className="font-medium">{formatINR(cart.subtotalPaise)}</span>
              </div>
              {cart.bundleApplied && bundleDiscount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>
                    Kit bundle · {cart.bundleApplied.name} (−{cart.bundleApplied.discountPct}%)
                  </span>
                  <span className="font-medium">− {formatINR(bundleDiscount)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Coupon {applied?.code}</span>
                  <span className="font-medium">− {formatINR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium">
                  {shippingFee === 0 ? <span className="text-primary">FREE</span> : formatINR(shippingFee)}
                </span>
              </div>
              {paymentMethod === "COD" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">COD fee</span>
                  <span className="font-medium">{formatINR(COD_FEE_PAISE)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm font-medium">Total payable</span>
              <span className="font-display text-2xl">{formatINR(total)}</span>
            </div>
            <p className="mt-1 text-right text-[11px] text-muted-foreground">incl. {formatINR(cart.gstAmountPaise)} GST · CGST/SGST or IGST printed on the invoice</p>

            {cart.hasOutOfStock && (
              <p className="mt-4 flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> Resolve out-of-stock items in your cart before placing the order.
              </p>
            )}

            <Button type="button" onClick={() => void placeOrder()} disabled={placing || cart.lines.length === 0 || cart.hasOutOfStock} className="mt-5 h-12 w-full text-base">
              {placing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
              {placing ? "Placing order…" : paymentMethod === "COD" ? `Place COD order · ${formatINR(total)}` : `Place order · ${formatINR(total)}`}
            </Button>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
              Shipping is free above ₹500; otherwise {formatINR(DEFAULT_SHIPPING_FEE_PAISE)}. By placing the order you accept the return & warranty policy.
            </p>
          </motion.div>
        </div>
      </aside>
    </div>
  );
}
