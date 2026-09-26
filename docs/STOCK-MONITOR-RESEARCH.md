# Stock Monitor — Employee Panel · Research & Design (DRAFT, NOT IMPLEMENTED)

> Status: **research only** — awaiting owner confirmation before any schema push or code.
> Owner request: *"stock monitor employee panel or whatever u call it; make that page panel everything related to it, schema and all ready, don't implement it right now, just research and keep in some md file."*
> This document is the single source for that future build. Nothing here is wired into `prisma/schema.prisma` or the app yet.

---

## 1. Problem statement

Patel Networks runs a counter + warehouse in Surat. Today, knowing "what do we actually have on the shelf right now?" means opening the full admin Inventory console — a manager-grade tool with mutation powers (adjust, import) that a counter employee shouldn't wield casually.

**Missing persona: the floor/counter employee** who needs to *look up and report*, not *mutate*. This panel is for them.

## 2. What "stock monitor" means here (scenarios)

| Scenario | Employee need |
|---|---|
| Customer at counter asks "do you have 4 more of this camera?" | Instant per-SKU availability (on-shelf vs reserved), without touching stock numbers |
| Morning shelf check / stock-taking day | A walk-order: list of SKUs to count, with expected qty, tick off mismatches |
| Something looks wrong on the shelf (damaged/missing) | Report a discrepancy → manager approves a correction (no direct mutation) |
| Wall-mounted shop display ("stock wall") | Auto-refreshing big-tile board: OUT / LOW / OK per product, brand-grouped |
| "When did this go missing?" | Movement history per SKU in plain language |

Key principle: **employees observe and propose; managers dispose.** Every stock change still flows through the existing `InventoryMovement` audit (source: MANUAL_ADJUSTMENT etc.) — the monitor adds a **request-and-verify layer**, never a parallel ledger.

## 3. Prior art & patterns used

- **Warehouse bin boards / andon boards** (lean retail): big glanceable tiles, colour = state, refresh cycle, exception-driven attention.
- **Cycle counting** (vs annual stock-taking): small continuous count sessions per category/brand — this is what `StockCountSession` models below.
- **Two-man rule for corrections**: propose → approve pattern (same trust model already used by order FSM + audit log).
- **Single-purpose devices**: the wall view assumes a shop tablet/TV; the phone view assumes employees' own phones; both read-only-first.

## 4. Roles & access

| Option | Assessment |
|---|---|
| **A. New `STAFF` role** (recommended) | New role in `ROLES` (`lib/constants.ts`): gets `/admin/stock-monitor` + `/admin/stock-monitor/wall` only. `requireRole([...])` already enforces per-route. Sidebar shell needs per-role nav filtering (small change in `admin-shell.tsx`). |
| B. Reuse `INVENTORY_MANAGER` | Zero role work, but then the panel adds nothing for that persona (they already have the full console) and there is no way to grant "view-only" to juniors. |

Decision when confirmed: **Option A**. Employee identity: existing admin email+password login (scrypt, rate-limited) — no new auth mechanism.

## 5. Feature set (v1 — when approved)

1. **Stock wall** (`/admin/stock-monitor`): big-tile board grouped by category → brand; tile = product, sub-line = per-SKU available (`currentStock − reservedStock`); colour states OUT (destructive) / LOW (amber, ≤ threshold) / OK (pine). Auto-refresh every 60 s + manual refresh; `prefers-reduced-motion` respected.
2. **SKU lookup** (`?q=` search): phone-number-grade speed — name/model/barcode contains (SQLite CI), one-tap call of movement history.
3. **Count session** (`/admin/stock-monitor/count`): pick category/brand → expected list → enter counted qty per SKU → submit. Mismatch produces a **CountVariance row**; matching lines close silently. Manager sees variances in the inventory console with a one-click "apply as MANUAL_ADJUSTMENT".
4. **Discrepancy report** (on any SKU): reason enum `DAMAGED | MISSING | FOUND | WRONG_LOCATION | OTHER` + note → pending request card for the manager.
5. **Movement ticker**: last N movements shop-wide with human phrasing ("−2 CP-PLUS-IR-BULLET · ORDER so-24xxxx").
6. **Explicitly NOT in v1**: direct stock mutation from this panel (that stays in Inventory console), purchase-order management, supplier fields, barcode scanner hardware support (phone camera later).

## 6. Schema draft (Prisma — DO NOT PUSH)

```prisma
// ============================================================
//  STOCK MONITOR (DRAFT — awaiting confirmation, see
//  docs/STOCK-MONITOR-RESEARCH.md · not yet in schema.prisma)
// ============================================================

// A scheduled/started counting session over a slice of the catalog.
model StockCountSession {
  id          String   @id @default(cuid())
  title       String                    // "Monsoon shelf check — cameras"
  status      String   @default("OPEN") // OPEN | COUNTING | SUBMITTED | CLOSED | CANCELLED
  // slice: snapshot of scope so later catalog edits don't skew the count
  scopeKind   String                    // CATEGORY | BRAND | ALL
  scopeRefId  String?                   // categoryId/brandId when scoped
  expected    Json?                     // [{ skuId, code, expectedQty }] snapshot
  openedById  String?
  openedByIdx User?    @relation("CountSessionsOpened", fields: [openedById], references: [id])
  closedById  String?
  closedAt    DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  lines       StockCountLine[]
  @@index([status, createdAt])
  @@map("stock_count_sessions")
}

// One SKU inside a count session: expected vs actually counted.
model StockCountLine {
  id           String   @id @default(cuid())
  sessionId    String
  session      StockCountSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  skuId        String
  sku          Sku      @relation("StockCountLines", fields: [skuId], references: [id], onDelete: Cascade)
  expectedQty  Int
  countedQty   Int?                    // null until counted
  variance     Int?                    // countedQty - expectedQty (derived on write)
  countedById  String?
  countedAt    DateTime?
  note         String?
  @@unique([sessionId, skuId])
  @@index([skuId])
  @@map("stock_count_lines")
}

// Employee-proposed correction; manager approves → real InventoryMovement.
model StockAdjustmentRequest {
  id          String   @id @default(cuid())
  skuId       String
  sku         Sku      @relation("StockAdjustmentRequests", fields: [skuId], references: [id], onDelete: Cascade)
  delta       Int                       // proposed signed change (e.g. -1)
  reason      String                    // DAMAGED | MISSING | FOUND | WRONG_LOCATION | OTHER
  note        String?
  status      String   @default("PENDING") // PENDING | APPROVED | REJECTED
  requestedById String?
  decidedById String?
  decidedAt   DateTime?
  // filled on approval: the InventoryMovement that executed the delta
  movementId  String?
  createdAt   DateTime @default(now())
  @@index([status, createdAt])
  @@index([skuId])
  @@map("stock_adjustment_requests")
}
```

Backlinks required on existing models when implemented: `User` gains `countSessionsOpened StockCountSession[] @relation("CountSessionsOpened")` and `Sku` gains `stockCountLines StockCountLine[] @relation("StockCountLines")` + `adjustmentRequests StockAdjustmentRequest[] @relation("StockAdjustmentRequests")`. No changes to `Inventory`/`InventoryMovement` — the monitor consumes them, never bypasses them.

Optional v2 (not drafted in detail): `BinLocation` (rack/shelf code on SKU) for walk-order sorting; `StockSnapshot` daily rollup for trend sparklines.

## 7. API surface draft

| Method & path | Role | Purpose |
|---|---|---|
| `GET /api/admin/stock-monitor/wall?q=&category=&brand=` | STAFF+ | tiles projection: product, per-SKU available, state |
| `GET /api/admin/stock-monitor/sku/:id/history` | STAFF+ | last 30 movements, human-phrased |
| `POST /api/admin/stock-monitor/count-sessions` | STAFF+ | open session (scope snapshot) |
| `PATCH /api/admin/stock-monitor/count-sessions/:id` | STAFF+ | submit counted quantities (bulk lines) |
| `POST /api/admin/stock-monitor/adjustment-requests` | STAFF+ | propose correction |
| `GET /api/admin/stock-monitor/requests?status=PENDING` | INVENTORY_MANAGER+ | manager queue |
| `POST /api/admin/stock-monitor/requests/:id/decide` | INVENTORY_MANAGER+ | approve (creates InventoryMovement + audit) / reject |

All mutation endpoints: Zod DTOs, `recordAudit` (`STOCK_COUNT_*`, `STOCK_REQUEST_*`), rate limits consistent with the rest of the console.

## 8. UI plan

- Route group stays inside `admin/(panel)` → inherits shell, role badges, audit culture.
- Wall page: `grid` of tiles (`min-h-[44px]` taps), `aria-live="polite"` ticker, state colours from existing tokens (no new palette).
- Count page: numeric steppers identical to cart qty pattern (`.press` active scale, tabular-nums).
- Manager's variance queue lives as a new tab in the existing Inventory console — no new module.

## 9. Open questions for the owner

1. Is the persona right — counter/warehouse staff with view+report only, or do they also adjust directly?
2. Wall display: shop TV/tablet always-on page (needs a kiosk-friendly "no chrome" mode) — wanted?
3. Count sessions: per week cadence, or on-demand only?
4. Should OUT/LOW tiles also trigger WhatsApp to the owner (notification service already has the plumbing)?
5. Barcode scanning via phone camera in v2?

## 10. Effort estimate (when approved)

Schema + push + seed touches: ~0.5 round · APIs: ~0.5 · wall + lookup UI: ~1 · count sessions + request/decide loop: ~1 · QA + polish: ~0.5. Total ≈ 3–4 rounds with the usual gates.
