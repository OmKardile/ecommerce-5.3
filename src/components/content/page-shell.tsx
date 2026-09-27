import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "./reveal";
import { HeroDecor } from "@/components/motion/parallax";

// Shared editorial page chrome for content surfaces (about, contact, faq,
// policies, blog). Hero band + two-column prose sections + CTA band.
// Design contract: warm paper bg, font-display headlines, label-caps
// eyebrows, hairline dividers, rounded-lg, generous whitespace.

const CONTAINER = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

/** Eyebrow in small caps with a hairline rule — used above section titles. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`label-caps flex items-center gap-3 ${className}`}>
      <span aria-hidden className="h-px w-8 bg-border" />
      {children}
    </p>
  );
}

/**
 * PageShell — consistent hero band (eyebrow, display headline, lede) followed
 * by page sections. Wraps everything in a semantic <article>.
 */
export function PageShell({
  eyebrow,
  title,
  lede,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  /** Optional right-aligned meta (e.g. "Last reviewed …") in the hero band. */
  aside?: string;
  children: ReactNode;
}) {
  return (
    <article className="flex-1">
      <header className="relative overflow-hidden border-b border-border bg-muted/40">
        <HeroDecor />
        <div className={`${CONTAINER} relative py-12 lg:py-16`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <Eyebrow>{eyebrow}</Eyebrow>
              <h1 className="mt-4 font-display text-3xl leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.75rem]">
                {title}
              </h1>
              {lede ? (
                <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{lede}</p>
              ) : null}
            </div>
            {aside ? (
              <p className="label-caps pb-1 !text-[10px] normal-case tracking-normal text-muted-foreground/80">
                {aside}
              </p>
            ) : null}
          </div>
        </div>
      </header>
      {children}
    </article>
  );
}

/**
 * ContentSection — editorial two-column layout: sticky-ish title column on the
 * left, prose/children on the right, separated by a hairline top rule.
 */
export function ContentSection({
  id,
  eyebrow,
  title,
  children,
  className = "",
  first = false,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  className?: string;
  first?: boolean;
}) {
  return (
    <Reveal>
      <section
        id={id}
        aria-labelledby={id ? `${id}-heading` : undefined}
        className={`${first ? "" : "border-t border-border"} py-10 lg:py-14 ${className}`}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4 min-w-0">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <h2
              id={id ? `${id}-heading` : undefined}
              className="mt-3 font-display text-2xl leading-snug tracking-tight lg:text-[1.7rem]"
            >
              {title}
            </h2>
          </div>
          <div className="lg:col-span-8 min-w-0">{children}</div>
        </div>
      </section>
    </Reveal>
  );
}

/**
 * CtaBand — closing call-to-action strip. Deep pine band, display headline,
 * single primary action (plus optional quiet secondary link).
 */
export function CtaBand({
  title,
  body,
  href,
  ctaLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  body: string;
  href: string;
  ctaLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <Reveal>
      <div className="rounded-lg bg-primary px-6 py-10 text-primary-foreground sm:px-10 lg:px-12 lg:py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl leading-snug tracking-tight lg:text-[1.7rem]">{title}</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-primary-foreground/80">{body}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-4">
            <Link
              href={href}
              className="group inline-flex items-center gap-2 rounded-full bg-primary-foreground px-6 py-2.5 text-sm font-medium text-primary transition-colors duration-200 hover:bg-background"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link
                href={secondaryHref}
                className="link-underline text-sm font-medium text-primary-foreground/90 hover:text-primary-foreground"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/** Standard content container — every page body section sits inside one. */
export function ContentContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${CONTAINER} py-10 lg:py-14 ${className}`}>{children}</div>;
}
