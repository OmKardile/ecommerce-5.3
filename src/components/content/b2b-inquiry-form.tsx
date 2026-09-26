"use client";

// B2B / wholesale inquiry form — commercial consultation desk.
// POSTs to /api/contact (zod-validated server-side, rate-limited per IP).

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { STORE } from "@/lib/constants";

type Field = "name" | "phone" | "email" | "companyName" | "gstin" | "message" | "productRef";

const INITIAL: Record<Field, string> = {
  name: "",
  phone: "",
  email: "",
  companyName: "",
  gstin: "",
  message: "",
  productRef: "",
};

export function B2BInquiryForm({ prefillProductRef }: { prefillProductRef?: string }) {
  const [values, setValues] = useState<Record<Field, string>>(() => ({
    ...INITIAL,
    productRef: prefillProductRef ?? "",
  }));
  const [submitting, setSubmitting] = useState(false);
  const [received, setReceived] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { toast } = useToast();

  function set(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
          email: values.email || undefined,
          companyName: values.companyName || undefined,
          gstin: values.gstin || undefined,
          message: values.message,
          productId: values.productRef || undefined,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        setReceived(true);
      } else {
        setFieldError(json.error ?? "Something went wrong. Please try again.");
        toast({
          title: "Inquiry not sent",
          description: json.error ?? "Please check the form and try again.",
          variant: "destructive",
        });
      }
    } catch {
      setFieldError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (received) {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-8"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-xl tracking-tight">Inquiry received</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Our trade desk responds within one working day. For urgent site requirements, call{" "}
            <a
              href={`tel:${STORE.supportPhone.replace(/\s/g, "")}`}
              className="text-foreground underline underline-offset-2"
            >
              {STORE.supportPhone}
            </a>{" "}
            during business hours.
          </p>
        </div>
        <p className="label-caps !text-[10px]">Reference logged · {new Date().toLocaleDateString("en-IN")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 sm:p-8" noValidate={false}>
      <h2 className="font-display text-xl tracking-tight">Request a quotation</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
        Tell us what the site needs — camera counts, recorder channels, storage window, cable runs. Fields marked
        optional can be added later with the trade desk.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="b2b-name">
            Your name <span aria-hidden>*</span>
          </Label>
          <Input
            id="b2b-name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="b2b-phone">
            Mobile number <span aria-hidden>*</span>
          </Label>
          <Input
            id="b2b-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            maxLength={14}
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="98765 43210"
            aria-describedby="b2b-phone-hint"
          />
          <p id="b2b-phone-hint" className="text-[12px] text-muted-foreground">
            Indian mobile — the trade desk calls this number.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="b2b-email">Email</Label>
          <Input
            id="b2b-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={120}
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="name@company.in"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="b2b-company">Company / firm name</Label>
          <Input
            id="b2b-company"
            name="companyName"
            autoComplete="organization"
            maxLength={120}
            value={values.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="Legal business name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="b2b-gstin">GSTIN</Label>
          <Input
            id="b2b-gstin"
            name="gstin"
            maxLength={15}
            value={values.gstin}
            onChange={(e) => set("gstin", e.target.value.toUpperCase())}
            placeholder="24AAACP1234F1Z8"
            aria-describedby="b2b-gstin-hint"
            className="font-mono text-sm uppercase"
          />
          <p id="b2b-gstin-hint" className="text-[12px] text-muted-foreground">
            Optional — printed on the tax invoice for input tax credit.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="b2b-product">Product or SKU reference</Label>
          <Input
            id="b2b-product"
            name="productRef"
            maxLength={160}
            value={values.productRef}
            onChange={(e) => set("productRef", e.target.value)}
            placeholder="e.g. CP Plus 8ch DVR, or a product link"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="b2b-message">
            Requirement <span aria-hidden>*</span>
          </Label>
          <Textarea
            id="b2b-message"
            name="message"
            required
            minLength={5}
            maxLength={2000}
            rows={5}
            value={values.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="Site type, number of cameras, indoor/outdoor split, recording retention needed, delivery pincode…"
            aria-describedby="b2b-message-hint"
          />
          <p id="b2b-message-hint" className="text-[12px] text-muted-foreground">
            The more specific the requirement, the sharper the quotation.
          </p>
        </div>
      </div>

      {fieldError ? (
        <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          {fieldError}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={submitting} className="rounded-full px-7">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden /> Send inquiry
            </>
          )}
        </Button>
        <p className="text-[12px] text-muted-foreground">
          Your details are used only to answer this inquiry. See the{" "}
          <a href="/privacy-policy" className="underline underline-offset-2 hover:text-foreground">
            privacy policy
          </a>
          .
        </p>
      </div>
    </form>
  );
}
