"use client";

// Scroll-linked parallax primitives — the storefront's shared motion language.
//
// Rules of engagement (design contract):
//  - transform-only animation (never top/left/width) → compositor-driven, no layout thrash
//  - every layer honours prefers-reduced-motion and renders fully static
//  - functional surfaces (cart, checkout, account, admin data panels) stay motion-quiet
//  - images overscale slightly (scale > 1) so the drift can never reveal a cropped edge

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

type ParallaxOffset = ["start start", "end start"] | ["start end", "end start"];

/**
 * ParallaxImage — backdrop/cover image that scrolls at a different speed than
 * the page. Renders an absolutely-positioned layer (clip happens at the nearest
 * `overflow-hidden` ancestor); the img itself carries the overscale + drift.
 *
 * Top-of-page usage (hero): offset={["start start", "end start"]} from="0%" to="-8%"
 * Mid-page usage (bands/covers): offset={["start end", "end start"]} from="-6%" to="6%"
 */
export function ParallaxImage({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  scale = 1.18,
  from = "0%",
  to = "-8%",
  offset = ["start start", "end start"],
  eager = false,
  hoverScale,
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  /** Static overscale that hides the drift margin. */
  scale?: number;
  /** Start/end translate across the tracked scroll range (CSS length or %). */
  from?: string;
  to?: string;
  offset?: ParallaxOffset;
  eager?: boolean;
  /** Optional while-hover scale (absolute value) for interactive banners. */
  hoverScale?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset });
  const y = useTransform(scrollYProgress, [0, 1], [from, to]);

  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        style={reduce ? { scale } : { y, scale }}
        whileHover={hoverScale ? { scale: hoverScale } : undefined}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`absolute inset-0 h-full w-full object-cover will-change-transform ${imgClassName}`}
      />
    </div>
  );
}

/**
 * ScrollDrift — global-scroll layer for top-of-page hero pieces. Deterministic
 * at load (scrollY === 0 → y = 0, opacity = 1), so there is no mount-time jump:
 * the layer simply lags the page scroll by `lag` px across `range`.
 */
export function ScrollDrift({
  children,
  className = "",
  lag = 90,
  range = 640,
  fadeTo,
  fadeRange,
}: {
  children: ReactNode;
  className?: string;
  /** How far the layer lags behind the page across `range` px of scroll. */
  lag?: number;
  range?: number;
  /** Optional partial fade (never below ~0.2 — copy stays legible/SEO-safe). */
  fadeTo?: number;
  fadeRange?: number;
}) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, range], [0, lag], { clamp: true });
  const opacity = useTransform(scrollY, [0, fadeRange ?? range], [1, fadeTo ?? 1], { clamp: true });

  return (
    <motion.div style={reduce ? undefined : { y, opacity }} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Drift — target-based drift for decorative layers mid-page (rings, glows,
 * dot-grids). Tracks the wrapper from "enters viewport bottom" to "leaves
 * viewport top"; `distance` px of travel around the resting position.
 */
export function Drift({
  children,
  className = "",
  distance = 32,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <div ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <motion.div style={reduce ? undefined : { y }} className="absolute inset-0 will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}

/**
 * HeroDecor — editorial decoration for content-page hero bands on warm paper
 * (about, faq, policies, contact, blog). A soft pine glow + brass counter-glow
 * + a faint dot grid, each drifting at a different speed for layered depth.
 * Purely decorative: aria-hidden, pointer-events-none, near-zero contrast.
 */
export function HeroDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Drift distance={26} className="!overflow-visible">
        <div className="absolute -right-24 -top-28 h-96 w-96 rounded-full bg-primary/[0.05] blur-3xl sm:h-[26rem] sm:w-[26rem]" />
      </Drift>
      <Drift distance={-18} className="!overflow-visible">
        <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-accent/[0.06] blur-3xl sm:h-80 sm:w-80" />
      </Drift>
      <Drift distance={14}>
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(color-mix(in srgb, var(--foreground) 7%, transparent) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(60% 90% at 78% 20%, black 0%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(60% 90% at 78% 20%, black 0%, transparent 100%)",
          }}
        />
      </Drift>
    </div>
  );
}

/**
 * BandDecor — concentric rings + glow for deep-pine bands (home kit-builder
 * strip). Rings drift at different speeds so the band reads as layered space.
 */
export function BandDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Drift distance={64}>
        <div className="absolute -right-40 top-1/2 h-[30rem] w-[30rem] -translate-y-1/2 rounded-full border border-primary-foreground/[0.07] sm:-right-32 sm:h-[36rem] sm:w-[36rem]" />
      </Drift>
      <Drift distance={-44}>
        <div className="absolute -right-24 top-1/2 h-[20rem] w-[20rem] -translate-y-1/2 rounded-full border border-primary-foreground/[0.09] sm:h-[24rem] sm:w-[24rem]" />
      </Drift>
      <Drift distance={30}>
        <div className="absolute -left-32 -bottom-24 h-80 w-80 rounded-full border border-primary-foreground/[0.05]" />
        <div className="absolute -left-24 -bottom-16 h-64 w-64 rounded-full bg-accent/[0.08] blur-3xl" />
      </Drift>
    </div>
  );
}
