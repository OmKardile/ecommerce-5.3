"use client";

// Platform-pitch enquiry form (showcase page) — the developer's leads.
// POSTs to /api/platform-enquiry (zod-validated server-side, rate-limited per
// IP). Deliberately NOT the store's trade-desk form (/contact): the audience
// here is "I want a commerce platform like this for my business".

import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DEVELOPER } from "@/lib/constants";

type Field = "name" | "contact" | "message";

const INTEREST_OPTIONS = [
  { value: "platform", label: "A platform like this for my business" },
  { value: "walkthrough", label: "A live walkthrough of the console" },
  { value: "other", label: "Something else" },
] as const;

const INTEREST_LABEL: Record<string, string> = {
  platform: "a platform like this",
  walkthrough: "a live walkthrough",
  other: "something else",
};

const INITIAL: Record<Field, string> = { name: "", contact: "", message: "" };

export function PlatformEnquiryForm() {
  const [values, setValues] = useState<Record<Field, string>>(INITIAL);
  const [interest, setInterest] = useState<string>("platform");
  const [submitting, setSubmitting] = useState(false);
  const [received, setReceived] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { toast } = useToast();

  function set(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  // Real synchronous fallback: a prefilled compose window to the developer.
  // Works even if server-side notifications aren't wired to live credentials.
  function mailtoHref(): string {
    const subject = `Platform enquiry — ${INTEREST_LABEL[interest] ?? "general"} — ${values.name}`;
    const body = `Name: ${values.name}\nReach me at: ${values.contact}\nInterested in: ${INTEREST_LABEL[interest] ?? "general"}\n\n${values.message}\n\n(sent from the platform showcase page)`;
    return `mailto:${DEVELOPER.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/platform-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          contact: values.contact,
          interest,
          message: values.message,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        setReceived(true);
      } else {
        setFieldError(json.error ?? "Something went wrong. Please try again.");
        toast({
          title: "Enquiry not sent",
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
      <div role="status" className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-8 text-foreground">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden />
        </span>
        <div>
          <h3 className="font-display text-xl tracking-tight">Enquiry received</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Your enquiry is logged and lands directly with {DEVELOPER.name}, the developer of this platform — replies
            usually go out within a working day. Want it in his inbox right now too?
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild className="rounded-full">
            <a href={mailtoHref()}>
              <Mail className="mr-2 h-4 w-4" aria-hidden />
              Email a copy now
            </a>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <a href={DEVELOPER.portfolio} target="_blank" rel="noopener noreferrer">
              Portfolio <ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
        </div>
        <p className="label-caps !text-[10px]">Logged · {new Date().toLocaleDateString("en-IN")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 text-foreground sm:p-8" noValidate={false}>
      <h3 className="font-display text-xl tracking-tight">Tell the developer</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
        One form, straight to the person who built this — not a ticket queue.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pe-name">
            Your name <span aria-hidden>*</span>
          </Label>
          <Input
            id="pe-name"
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
          <Label htmlFor="pe-contact">
            Email or phone <span aria-hidden>*</span>
          </Label>
          <Input
            id="pe-contact"
            name="contact"
            autoComplete="email"
            required
            maxLength={120}
            value={values.contact}
            onChange={(e) => set("contact", e.target.value)}
            placeholder="you@company.in — or a mobile number"
            aria-describedby="pe-contact-hint"
          />
          <p id="pe-contact-hint" className="text-[12px] text-muted-foreground">
            Whichever you actually check — the reply comes here.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="pe-interest">What brings you here?</Label>
          <select
            id="pe-interest"
            name="interest"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {INTEREST_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="pe-message">
            What does your business need? <span aria-hidden>*</span>
          </Label>
          <Textarea
            id="pe-message"
            name="message"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            value={values.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="Your trade, how you operate today, what a system like this should take off your plate…"
            aria-describedby="pe-message-hint"
          />
          <p id="pe-message-hint" className="text-[12px] text-muted-foreground">
            Two honest lines beat a formal RFP.
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
              <Send className="h-4 w-4" aria-hidden /> Send enquiry
            </>
          )}
        </Button>
        <p className="text-[12px] text-muted-foreground">
          Reaches the developer only — used solely to reply. See the{" "}
          <a href="/privacy-policy" className="underline underline-offset-2 hover:text-foreground">
            privacy policy
          </a>
          .
        </p>
      </div>
    </form>
  );
}
