# Patel Networks / MegaTech — Render Deployment Runbook (Neon Postgres)

The stack on Render is a **single Node web service** with an **external Neon
Postgres** database. Nothing is stored on Render's disk, so free-plan
restarts lose no data. `render.yaml` in the repo root encodes everything
below — the Blueprint path is the fastest.

Two paths: **A. Blueprint (recommended, ~5 min)** or **B. Manual web service**.

---

## 0. Prerequisites (all done)

- ✅ Neon database provisioned, schema pushed, seeded (Task 27). If you ever
  need to redo it: `bun run db:push` then `bun run db:seed` with
  `DATABASE_URL` pointing at Neon.
- ✅ Repo builds with `npm` (package-lock.json committed, lockfileVersion 3).
- ✅ `render.yaml` Blueprint committed.
- Seeded logins: **owner** `superadmin@patelnetworks.in` / `patel@admin2026`,
  staff demos per `docs/README.md`, test customer `+91 98765 43210`.

## A. Blueprint deploy

1. Render Dashboard → **New + → Blueprint** → pick this repo.
2. Render parses `render.yaml` and prompts for the `sync: false` values:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon Dashboard → Connection Details → copy the string. Keep `?sslmode=require`; Prisma tolerates `channel_binding=require` if present. |
   | `NEXT_PUBLIC_APP_URL` | `https://<your-service-name>.onrender.com` (guess now; fix after first deploy + re-deploy — it is inlined at build time). |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Optional (DB ships pre-seeded). Set for disaster-recovery bootstrap parity. |

   `JWT_SECRET` is auto-generated and kept stable; `NODE_VERSION=22` is fixed.
3. **Apply** → first build runs
   `npm install && npm run db:sync && npm run build`, then starts
   `node .next/standalone/server.js` on Render's `PORT`.
4. Verify: open `https://<service>.onrender.com/api/health` →
   `{"ok":true,"data":{"status":"healthy","db":"up",...}}`, then log into
   `/admin/login` with the owner credentials.

## B. Manual web service (same result, no render.yaml)

1. **New + → Web Service** → connect the repo.
2. Runtime **Node**; Build command:
   `npm install && npm run db:sync && npm run build`; Start command:
   `npm run start`; Instance type: Free (or Starter for client demos).
3. Environment → add the same variables as the table above (`JWT_SECRET`:
   generate a value with `openssl rand -hex 32`).
4. Create Web Service → verify as in A.4.

## After the first deploy

- **Fix `NEXT_PUBLIC_APP_URL`** if you guessed it: Environment → set the real
  `https://<service>.onrender.com` → *Manual Deploy → Clear build cache &
  deploy* (client bundles bake it in at build time).
- **Custom domain**: Render → Settings → Custom Domains → point the CNAME,
  then set `NEXT_PUBLIC_APP_URL` to the domain and redeploy once.
- **Schema changes** (later rounds): push the branch — `db:sync` in the build
  applies additive changes automatically. Destructive changes fail the build
  on purpose (`prisma db push` without `--accept-data-loss`); apply those
  manually from the Render Shell (`npx prisma db push`) after reviewing.
- **Reseed** (optional, wipes catalog + users): Render Shell → `npm run db:seed`.

## Known postures & caveats

- **Free plan spin-down**: after ~15 idle minutes the service sleeps; the
  next visit wakes it in ~50 s. For a client demo, either click the link a
  minute before the call or run on Starter. Neon free tier also cold-starts
  (~1 s first query).
- **Ephemeral disk**: nothing persistent lives on Render (DB is Neon, images
  are URL-based) — restarts are safe by design.
- **Connection pooling**: a long-running Node server holds a small Prisma
  pool on the direct Neon endpoint — fine on free tier. If you ever scale to
  many instances, switch `DATABASE_URL` to Neon's **pooled** host
  (`...-pooler.<region>.aws.neon.tech`).
- **Simulations stay on until real keys are set**: payments/OTP/shipping run
  in their documented deterministic-simulation modes (see
  `deploy/ENV-SETUP.md` for the fill-in order when the client provides keys).

## Troubleshooting quick map

| Symptom | Cause → fix |
|---|---|
| Build fails at `db:sync` | Destructive schema change pending → run `npx prisma db push` from the Render Shell after review. |
| `P1001 can't reach database` | Wrong `DATABASE_URL` / Neon compute suspended → check the Neon Dashboard, keep `sslmode=require`. |
| Login works but next request logs out | `JWT_SECRET` changed between deploys → it must stay stable (Blueprint `generateValue` keeps it). |
| Pages show old domain in OG/canonicals | `NEXT_PUBLIC_APP_URL` is build-time → clear cache & redeploy after changing. |
| `npm ci`/install version drift | package-lock.json is the source of truth — commit it whenever package.json changes. |
