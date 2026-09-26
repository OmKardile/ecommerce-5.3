# Decision records

The old repo carried ADR-001..019. During Task 0 (requirements extraction) the lead hit hard conflicts between those ADRs, the source specs, and the client's stated requirements. They were resolved explicitly — never silently — as records **C1..C12** (reproduced below exactly as recorded in `/worklog.md`), and two new ADRs (**ADR-020**, **ADR-021**) were added during this build.

## Priority order used for every conflict

1. **Client requirement** (explicit statements from the client, e.g. "client-owned VPS PostgreSQL; DO NOT USE Supabase/Firebase/managed DB")
2. **Latest dated decision** (a newer ADR overrides an older one)
3. **Spec** (task cards / master plan documents)
4. **Old plan** (stale docs from the previous repo)
5. **Implementation** (what the code already does, when nothing else contradicts)

## C1..C12 conflict resolutions (verbatim from worklog Task 0, item 12)

> 12. HARD CATALOG CONFLICTS RESOLVED (documented, NOT silently):

- **C1.** ADR-009 says Supabase PostgreSQL; CLIENT REQUIREMENT says client-owned VPS PostgreSQL, "DO NOT USE Supabase/Firebase/managed DB" -> SELECT client requirement (priority 1). Dockerized PostgreSQL on VPS. Sandbox dev runs SQLite (platform constraint) with a 100%-portable schema (no Prisma enums, no String[], money as integer paise); single-line provider switch documented for VPS.
- **C2.** ADR-001 uses Server Actions; platform rule mandates API route handlers -> SELECT route handlers for ALL mutations (ADR-001 already permits Route Handlers). Zod-validated DTOs.
- **C3.** Old UI = dark slate/indigo "surveillance" theme; NEW task ui_ux mandates editorial premium light design (Fraunces-like display serif, restrained palette, no purple/blue AI gradients, no neon) -> SELECT new creative direction (priority 1).
- **C4.** ADR-008 says Argon2id; native argon2 module unreliable in sandbox/Alpine -> SELECT Node stdlib crypto.scrypt (strong KDF, zero native deps); Argon2id swap documented as optional on VPS.
- **C5.** Money: Decimal vs integer paise (docs allow either) -> SELECT integer paise everywhere (decimal-safe, portable).
- **C6.** OrderItem.serialNumbers was String[] (PG-only) -> JSON string field (portable).
- **C7.** Tech doc invoice GSTIN 24AABCP1234F1Z9 vs ADR-014 24AAACP1234F1Z8 -> SELECT ADR-014 (latest dated) + env override.
- **C8.** Deployment docs (Render/Vercel) vs client VPS+Docker -> SELECT Docker Compose + Nginx reverse proxy on client VPS.
- **C9.** "Excel import/export" -> CSV (Excel-compatible) to avoid heavy binary deps; documented.
- **C10.** Old repo test scripts vs platform "no test code" rule -> typecheck + lint + agent-browser QA + /api/health instead.
- **C11.** Platform rule "only / route visible in preview" vs task's mandatory 26-route page map -> build full route map (user task is explicit; in-app navigation works in preview).
- **C12.** AdminProfile model in old docs -> simplified to role+fullName on User (documented; no functionality lost).

Per-record rationale against the priority ladder:

| Record | Winner | Losing source | Priority rationale |
| --- | --- | --- | --- |
| C1 | VPS PostgreSQL + portable schema | ADR-009 (Supabase) | Client requirement outranks any old ADR; SQLite only as sandbox consequence |
| C2 | Route Handlers for all mutations | ADR-001 (Server Actions) | Platform rule; ADR-001 itself permits Route Handlers, so no decision was reversed, only one option selected |
| C3 | Editorial light theme | Old dark surveillance UI | New creative spec (priority 3) + explicit prohibition of dark/neon/gradient direction; old UI is "old plan" (priority 4) |
| C4 | scrypt | ADR-008 (Argon2id) | Implementation feasibility in this platform (native argon2 unreliable in sandbox/Alpine); security parity documented, swap optional on VPS |
| C5 | Integer paise | Decimal faction | Docs allowed either; integer is decimal-safe AND portable (supports C1) |
| C6 | JSON string for serialNumbers | `String[]` | PostgreSQL-only type would break C1's portability guarantee |
| C7 | GSTIN `24AAACP1234F1Z8` | Tech-doc GSTIN `24AABCP1234F1Z9` | Latest dated decision (ADR-014) wins over older spec text; `STORE_GSTIN` env keeps it configurable |
| C8 | Docker Compose + nginx on VPS | Render/Vercel deployment docs | Client VPS requirement (same driver as C1) |
| C9 | CSV (Excel-compatible) | "Excel import/export" | Avoids heavy binary deps; Excel still opens CSV; functionality preserved |
| C10 | typecheck + lint + agent-browser QA + `/api/health` | Old repo test scripts | Platform "no test code" rule is a hard constraint; QA value preserved through browser QA and smoke curl suites |
| C11 | Full 26-route page map | Preview-visibility rule | The user task is explicit and mandatory; in-app navigation works in preview even if only `/` is the landing view |
| C12 | role + fullName on User | AdminProfile model | Simpler surface with no functionality lost; RBAC roles already on User |

## ADR-020: Seed image bank is an external JSON file, with typographic placeholders

**Status:** accepted (Phase 2).

**Context:** the storefront and admin need real product photography, but no image assets were supplied with the source docs; inventing "AI-generated" imagery was prohibited by the creative direction, and the sandbox has no asset pipeline.

**Decision:**

- Product/blog/banner imagery loads from an optional external file `prisma/seed-images.json` mapping image keys to URL arrays (e.g. `{ "bullet": ["https://...", ...] }`), consumed round-robin by the seed's `img()` helper.
- No generated imagery is committed to the repo; operators fill the bank (or per-product image URLs via the admin product form) with their own licensed photos.
- When the bank or a URL is absent, image fields stay null and every surface degrades gracefully to typographic placeholders (gallery panel, PostCover panel, ProductCard fallback) per the design system.
- The admin product form supports adding real image URLs at any time; banners/blog editors take explicit `imageUrl`/`coverImageUrl`.

**Consequences:** fresh checkouts show an intentionally quiet, editorial catalog rather than fake photos; adding imagery later is data-only (no code change).

## ADR-021: SQLite in dev / PostgreSQL in production via a portable schema

**Status:** accepted (Phase 1, reinforces C1).

**Context:** the build sandbox provides only SQLite (`db/custom.db`), while the client requires self-hosted PostgreSQL on their VPS. A schema fork (two dialects) would drift immediately.

**Decision:** maintain ONE `prisma/schema.prisma` that is 100% valid for both providers by construction:

- No Prisma enums — string columns validated by Zod schemas and constant maps (`ORDER_STATUSES`, `MOVEMENT_REASONS`, roles, slots).
- No native array types — array-shaped data stored as JSON strings (`serialNumbers`, `tags`, `specifications`, `attributes`, `documents`, audit/setting values).
- All money as integer paise — no `Decimal` columns.
- Provider switch is a single line (`provider = "postgresql"` in the datasource block) plus `DATABASE_URL`; `db push` / `migrate` behave identically on both.

**Consequences:** zero dialect-specific code in services; switching to production is a config change (see DATABASE.md and DEPLOYMENT.md). Trade-off: no database-level enum guarantees (enforced instead at the application boundary) and no PG array operators (unnecessary for this domain).
