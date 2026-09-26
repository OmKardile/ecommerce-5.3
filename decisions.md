# Decisions (living ADR log)

Older records: conflict resolutions **C1..C12** and **ADR-020/021** live in [`docs/DECISIONS.md`](docs/DECISIONS.md). New decisions from recent rounds are recorded here, newest first.

---

## D-6 · 2026-09-27 · Shipping webhook auth = shared secret, not HMAC

**Context**: `POST /api/webhooks/shipping` (carrier tracking events) accepted unauthenticated POSTs — anyone who guessed an AWB could push `DELIVERED`. Razorpay-style HMAC isn't available: Shiprocket/Delhivery webhooks don't sign bodies the way Razorpay does.

**Decision**: optional shared-secret token (`SHIPPING_WEBHOOK_TOKEN`), presented as `x-webhook-token` header or `?token=`. Set → enforced (401 otherwise). Unset → sandbox posture, accept but `console.warn` per request so production-without-token is visible in logs immediately. Documented in `.env.example`, env guides and PRODUCTION-CHECKLIST.

**Rejected**: IP allow-listing (carrier egress IPs are not stable/documented); no-auth-with-obscurity (the actual hole).

## D-5 · 2026-09-27 · recordAudit self-heals stale sessions instead of failing

**Context**: admin sessions carry `userId`; a DB reseed invalidates them against the `AuditLog.userId` FK → every admin audit write silently vanished (caught by try/catch). Discovered during the reviews round.

**Decision**: on Prisma `P2003`, retry once **without** `userId`, embedding the dropped id in `details.auditUserIdDropped` + `console.warn`. The trail (action/entity/details) matters more than attribution. Sessions self-heal on next login; no per-request DB session validation added (cost not justified while JWTs are signed + httpOnly and every page/API already resolves role).

## D-4 · 2026-09-27 · Reviews are moderated by default; PDP shows approved-only

**Context**: reviews schema already had `isApproved` default false, but no admin surface existed — submissions could never go live.

**Decision**: `/admin/reviews` moderation console (Pending default tab, approve/un-publish/delete, audit-logged). PDP keeps `isApproved: true` filter. Verified-purchase chip renders from `isVerified` (order-derived). Deleted reviews are hard deletes (spam/abuse) with audit trail.

## D-3 · 2026-09-26 · Product cards bind OOS at product level, PDP at variant level

**Context**: variant `inStock` on cards would show "out of stock" for purchasable products (any in-stock variant).

**Decision**: cards = product-level availability (cheapest variant drives price); OOS + notify-me lives on the PDP variant selector. Matches Amazon/Flipkart convention. Future toggle if the owner wants variant-aware cards.

## D-2 · 2026-09-26 · Plain role=tablist button groups over Radix Tabs in admin

**Context**: Radix Tabs activation proved unreproducible under automation QA and duplicated an existing pattern.

**Decision**: all admin tab UIs (orders console, trade desk, GSTR-1, reviews) use the shared plain-button `role="tablist"` pattern. Consistency + testability over component variety.

## D-1 · 2026-09-25 · Phone normalization: strip prefixes only when unambiguous

**Context**: `+91 98765 43210` paste produced `+919198765432` (old code kept the FIRST 10 digits).

**Decision**: `localPhoneFromInput()` strips `91` only when total digits ≥ 12, strips leading `0` only when ≥ 11, then takes the LAST 10. Shared by OTP login, checkout, address book. Guest `track` remains phone-as-credential with hard rate limits + sanitized projections (documented posture).
