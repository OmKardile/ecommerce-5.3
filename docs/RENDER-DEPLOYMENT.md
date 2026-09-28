# Patel Networks / MegaTechzy — Render Staging Deployment Guide

> **STATUS (Task 29): LIVE** — the Node-runtime path is deployed at
> **https://patelnetworks.onrender.com** (`/api/health` → `{db:"up"}` on the
> shared Neon DB). Start-command gotcha learned live: Render sets `HOSTNAME`
> to the service hostname, so the standalone server MUST pin
> `HOSTNAME=0.0.0.0 PORT=$PORT` — `npm run start` now does this in-repo.
> Full post-mortem: [incidents/2026-09-27-render-502-proxy-unreachable.md](./incidents/2026-09-27-render-502-proxy-unreachable.md).

> **Which Render path should I use?** Since Task 27 there are two supported
> ways to run this repo on Render:
> 1. **Node runtime + Blueprint (recommended — fastest)**: `render.yaml` +
>    package-lock.json, build `npm install && npm run db:sync && npm run build`.
>    Full runbook: **[`deploy/RENDER-STEPS.md`](../deploy/RENDER-STEPS.md)**.
> 2. **Docker runtime (this document)**: builds the repo Dockerfile (bun
>    inside the image) — matches the VPS Docker-Compose production path
>    1:1. Use it when you want the container parity.
> Both connect to the same external Neon Postgres; data is identical either way.


> **Goal**: Auto-deploy the app to a live URL on every GitHub commit. No local dev server needed — just `git push` and Render rebuilds + republishes automatically.
>
> This is a **staging/preview environment**, not the final production deployment (which is the client's Ubuntu VPS via Docker Compose per [`deploy/DEPLOY-STEPS.md`](../deploy/DEPLOY-STEPS.md) and [DEPLOYMENT.md](./DEPLOYMENT.md)). Render gives you a public URL to demo and QA the app while the VPS is being provisioned.

---

## How it works

```
  You commit to GitHub (patel-5.3)
         │
         ▼
  Render detects the push to main
         │
         ▼
  Render builds the committed Dockerfile (Docker runtime):
    oven/bun:1 deps      → bun install --frozen-lockfile (bun.lock respected)
    oven/bun:1 builder   → sed provider sqlite→postgresql → prisma generate
                         → bun run build (Next.js standalone; .next/static + public
                           baked into .next/standalone by the package.json script)
    node:22-slim runner  → non-root user, HEALTHCHECK /api/health, PORT=3000
         │
         ▼
  Render starts the container (no start command needed — the image defines it):
    docker-entrypoint.sh → RUN_MIGRATIONS=true → prisma db push --skip-generate
                         → exec node server.js  (standalone, HOSTNAME=0.0.0.0)
         │
         ▼
  Live URL: https://patel-53.onrender.com  (auto-updated)
         │
         ▼
  App connects to: managed staging PostgreSQL (Render Postgres / Neon / Supabase)
```

**You push → Render builds → site is live in ~2-3 minutes.** Zero local setup.

---

## Why the Docker runtime (primary path)

The repo carries **`bun.lock` but no `package-lock.json`**. Render's native Node runtime installs with `npm install`, which cannot be frozen against our Bun lockfile — every build resolves dependencies fresh and loses lockfile reproducibility. The **Docker runtime** sidesteps this entirely: Render builds the committed multi-stage `Dockerfile` (oven/bun builder → node:22-slim runner), which is *the exact same image* production runs on the VPS. Staging therefore matches production byte-for-byte:

- **Install**: `bun install --frozen-lockfile` against the committed `bun.lock`.
- **Provider switch**: the image build seds `prisma/schema.prisma` from `sqlite` to `postgresql` in-image (Dockerfile, `RUN sed -i ...` after `COPY . .`) — the repo file stays untouched, exactly like production.
- **Start command**: defined by the image itself — `docker-entrypoint.sh` runs the migration gate (`RUN_MIGRATIONS=true` → `prisma db push --skip-generate`) then `exec node server.js`. Render needs no Build/Start Command fields at all.
- **Port & health**: the image binds `0.0.0.0:3000` (`EXPOSE 3000`), so Render just needs the health check path `/api/health`.

---

## Prerequisites

1. The GitHub repo: https://github.com/OmKardile/patel-5.3 (branch `main`)
2. A Render account (free signup at https://render.com — sign in with GitHub)
3. A managed **staging PostgreSQL** — SQLite is impossible on Render:
   - Render's filesystem is **ephemeral**: a SQLite file is wiped on every deploy.
   - The repo schema declares `provider = "sqlite"` anyway; the image build switches it, but the storage problem remains.
   - Use **Render Postgres**, or any external managed provider (Neon, Supabase) — **for staging only**. Connection format:
     ```
     postgresql://<user>:<pass>@<host>:5432/<db>?sslmode=require
     ```

---

## Step 1 — Create a Web Service on Render

1. Go to https://dashboard.render.com → **New +** → **Web Service**

2. Connect your GitHub account if prompted, then select the repo:
   ```
   OmKardile/patel-5.3
   ```

3. Configure the service:

   | Field | Value |
   |---|---|
   | **Name** | `patel-53` (this becomes the URL subdomain) |
   | **Runtime** | `Docker` (Render builds the committed `Dockerfile`) |
   | **Region** | Closest to your users (e.g., `Singapore` for India — lowest latency) |
   | **Branch** | `main` |
   | **Root Directory** | (leave blank) |
   | **Build Command** | (leave blank — defined by the Dockerfile) |
   | **Start Command** | (leave blank — defined by `docker-entrypoint.sh` → `node server.js`) |
   | **Port** | `3000` (auto-detected from `EXPOSE 3000`) |
   | **Health Check Path** | `/api/health` |
   | **Instance Type** | `Free` (sleeps after 15 min inactivity) or `Starter` ($7/mo, always-on) |

4. Click **Create Web Service**. Render will start the first build immediately.

---

## Step 2 — Set environment variables

After creating the service, go to the **Environment** tab and add these variables (Render stores them securely — they are not committed to git):

| Key | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://<user>:<pass>@<host>:5432/<db>?sslmode=require` | The **staging** Postgres (Render Postgres / Neon / Supabase) — never the production VPS DB |
| `JWT_SECRET` | output of `openssl rand -hex 32` | Signs session JWTs **and** hashes OTP codes |
| `NEXT_PUBLIC_APP_URL` | `https://patel-53.onrender.com` | The Render URL, **no trailing slash**. Inlined into client bundles at build time |
| `NODE_ENV` | `production` | See the warning below |
| `RUN_MIGRATIONS` | `true` | Entrypoint runs `prisma db push --skip-generate` against the staging DB on every boot |
| `ADMIN_EMAIL` | e.g. `staging@patelnetworks.in` | SUPER_ADMIN bootstrap on first `/admin/login` |
| `ADMIN_PASSWORD` | a strong random password (`openssl rand -base64 18`) | With the above — never the seed default |

> ⚠️ **NODE_ENV must be `production` (or left unset)** — never `staging`, `development`, or any non-standard value. A non-production NODE_ENV derails Next.js prerendering of server components and crashes the build/boot with `Cannot read properties of null (reading 'useContext')`.

> 🚫 **Not applicable in 5.3 — do not port these from the patel-5.2 guide:**
> - **`DIRECT_URL`** — 5.2 needed it to bypass Supabase's PgBouncer pooler during Prisma operations. 5.3's `prisma/schema.prisma` has no `directUrl` block and nothing pools the staging DB. One `DATABASE_URL` is all Prisma needs.
> - **`JWT_EXPIRES_IN`** — session lifetime is fixed at `7d` in `src/lib/session.ts`; there is no such variable in 5.3.
>
> **Optional provider keys (Razorpay / Shiprocket / Delhivery / SMS / WhatsApp) may be omitted entirely.** Missing or `placeholder` credentials activate the documented deterministic simulation: `order_sim_*` payments via the sandbox-only simulate endpoint, `DELH...` AWBs, and `[SIMULATED SMS]` OTPs printed to the Render logs. See [ENVIRONMENT.md](./ENVIRONMENT.md).

Click **Save Changes**. Render rebuilds with the new env vars.

---

## Step 3 — Enable auto-deploy

1. Go to **Settings** → scroll to **Auto-Deploy**
2. Ensure **"Deploy the latest commit on every push to the main branch"** is ✅ enabled
3. Now every `git push` to `main` triggers a rebuild automatically

---

## Step 4 — Verify the deployment

1. Wait for the first build to finish (~2-3 minutes). Watch the **Events** tab or the build logs.

2. Once it shows **"Live"**, open the URL Render assigned (e.g., `https://patel-53.onrender.com`).

3. Verify:
   ```bash
   # The homepage should render
   curl -fsS https://patel-53.onrender.com/ | grep -o '<title>[^<]*</title>'
   # Expected: <title>Patel Networks — CCTV & Networking Hardware</title>

   # Health check — expect {"status":"healthy","db":"up","time":"..."}
   curl -fsS https://patel-53.onrender.com/api/health
   ```
   > Note: `/api/health` answers **200 even when the DB is unreachable** (it prints `"status":"degraded","db":"down"`). Render's HTTP-based health check will show Live either way — always eyeball the JSON body for `"db":"up"`.

4. Test a few routes:
   - `https://patel-53.onrender.com/products` — product catalog with images
   - `https://patel-53.onrender.com/admin/login` — admin login (bootstrap with your `ADMIN_EMAIL`/`ADMIN_PASSWORD`)
   - `https://patel-53.onrender.com/kit-builder` — 5-step CCTV kit builder

✅ **Checkpoint**: the site is live and renders correctly.

---

## Native Node runtime (fallback path — secondary)

If you must use the Node runtime instead of Docker (e.g., to skip image builds), configure:

| Field | Value |
|---|---|
| **Runtime** | `Node` |
| **Build Command** | `sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma && npm install && npx prisma generate && npm run build` |
| **Start Command** | `npx prisma db push --skip-generate && node .next/standalone/server.js` |

Why each piece:

- **The `sed` runs BEFORE `prisma generate`** — this mirrors exactly what the Dockerfile does at line ~60 inside the image. The repo schema declares `provider = "sqlite"` (sandbox constraint); without the switch, Prisma generates a SQLite client and every query fails at runtime against Postgres.
- **`npm install`** — unavoidable on this path (no `package-lock.json` exists; builds are not lockfile-reproducible). This is the core reason the Docker path is primary.
- **`prisma db push` lives in the Start Command** — the `RUN_MIGRATIONS` gate is a `docker-entrypoint.sh` construct and **does not exist** in a bare Node process, so the schema push must be folded into startup. The schema must already be pushed before the server accepts traffic.
- **Static files**: our `package.json` build script **already copies** `.next/static` and `public/` into `.next/standalone/` (`next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`). Unlike patel-5.2 — where the `cp` steps had to be appended to the Render build command manually — no extra command is needed here. **Do not simplify the build script**; that is the classic cause of missing CSS/images (see troubleshooting).
- `node .next/standalone/server.js` (not `next start`) because `next.config.ts` sets `output: "standalone"`; the standalone server respects Render's injected `PORT`.

---

## Your new workflow

```bash
# 1. Make changes
# 2. Commit + push
git add -A
git commit -m "feat: <your change>"
git push origin main

# 3. Wait ~2-3 minutes
# 4. View the live site: https://patel-53.onrender.com
```

Render auto-detects the push, rebuilds, and deploys. You see the change live on the internet.

---

## Cost

| Tier | Price | Behavior |
|---|---|---|
| **Free** | $0 | Sleeps after 15 min of inactivity. First request after sleep takes ~30 seconds to wake. 750 build minutes/month. Fine for staging/preview. |
| **Starter** | $7/month | Always-on (no sleep). 750 build minutes/month. Better for demos/showing clients. |
| **Standard** | $25/month | More RAM + CPU. Only needed at scale. |

> The free **Render Postgres** instance expires after **30 days** — for a longer-lived staging environment use a Starter Postgres or an external provider (Neon/Supabase free tiers).

**Recommendation**: start on **Free**. If the 30-second wake delay annoys you, upgrade to **Starter** ($7/mo).

---

## Important notes

### 1. The database must be Postgres, and staging-only

SQLite cannot work on Render (ephemeral filesystem + repo provider). Point `DATABASE_URL` at a managed Postgres. **Never point staging at the production database** — the VPS Postgres is private to the compose network, and staging QA data must never contaminate customer records. Staging gets its own DB, full stop.

Demo/QA fixtures (the two trade-desk demo inquiries, wishlist demo rows) can be purged with the repo's cleaner conventions: `bun run scripts/qa-clean.ts` (removes demo inquiries/users created by `scripts/qa-fixtures.ts`) — run it locally with `DATABASE_URL` pointed at the staging DB, or via Render Shell on paid plans.

### 2. Seeded/bootstrap admin credentials

The seed/bootstrap default is `superadmin@patelnetworks.in` / `patel@admin2026`. On Render, set `ADMIN_EMAIL` + `ADMIN_PASSWORD` **before** the first `/admin/login` submit so the SUPER_ADMIN is bootstrapped with your values. This default must be overridden for anything publicly reachable.

### 3. Build-time database access

`prisma generate` is local-only (no DB contact), but `next build` statically pre-renders DB-backed pages (home hero banners, catalog rails). `DATABASE_URL` must therefore be set **and reachable during the build** — on Render the environment variables are available to the build, so simply set them before the first deploy.

### 4. `NEXT_PUBLIC_APP_URL` is baked at build time

The Dockerfile takes it as a build `ARG` and Next.js inlines it into client bundles (metadataBase, canonicals, sitemap). If you change it later, trigger **"Clear build cache & deploy"** so the new value is re-inlined. All other variables are read at runtime.

### 5. Free tier cold starts

On the Free tier the app sleeps after 15 minutes of no requests. The first request after sleep takes ~30 seconds (Render spins up the instance); subsequent requests are fast. If this is a problem for demos, upgrade to Starter ($7/mo, always-on).

### 6. When the production VPS is ready

Keep Render as the permanent staging environment; production stays on the client's VPS (`deploy/DEPLOY-STEPS.md`). There is no `DIRECT_URL`/Supabase decommissioning dance like 5.2 — the two environments simply carry different `DATABASE_URL` values and different databases, and never share data.

---

## Troubleshooting

| Symptom | Cause & fix |
|---|---|
| **Build fails with "Prisma can't reach the database"** | `DATABASE_URL` is unset or unreachable from Render's network; a managed DB that is paused or expired (free Render Postgres dies after 30 days) produces the same error. On the native path, the provider `sed` must run **before** `npx prisma generate`. |
| **App deploys but shows 500 / Internal Server Error** | Check the **Logs** tab. Usual causes: env var typo, wrong DB password. A trailing slash on `NEXT_PUBLIC_APP_URL` breaks canonical/cookie URLs. |
| **CSS/images missing on the live site** | Docker path: shouldn't happen (`.next/static` + `public` are baked into `.next/standalone` by the canonical build script inside the image). Native path: someone simplified the `package.json` build script — restore it to `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`. |
| **"Port already in use" / app unreachable** | Render injects `PORT` and the standalone `server.js` respects it; our Dockerfile pins `PORT=3000` + `HOSTNAME=0.0.0.0` inside the container and Render's Docker runtime auto-detects the bound port. Only an issue if you hand-roll a start command that hardcodes a conflicting port. |
| **Data disappears after every deploy** | A `file:` SQLite URL was used by mistake — Render's filesystem is ephemeral and the repo schema targets SQLite. Use Postgres (`postgresql://...`). |
| **Render shows Live but health prints `"db":"down"`** | `/api/health` always answers 200; the JSON body is the truth. Fix `DATABASE_URL` (host/port/password), confirm the managed DB is running. |

---

## Quick reference — Render setup in 4 steps

1. **Render dashboard** → New Web Service → connect `OmKardile/patel-5.3` → Runtime **Docker** (leave Build/Start Command empty — the committed Dockerfile + `docker-entrypoint.sh` define them)
2. **Health Check Path**: `/api/health` · port `3000` (auto-detected from `EXPOSE`)
3. **Environment vars**: `DATABASE_URL` (staging Postgres), `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `NODE_ENV=production`, `RUN_MIGRATIONS=true`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`
4. Push to `main` → live in 2-3 minutes

That's it. Push to `main` → live in 2-3 minutes.

---

<p align="center">
<em>A personal project — authored by <a href="https://omkardile.is-a.dev/">Omkar Kardile</a> — Patel Networks / MegaTechzy</em><br/>
<sub>Surveillance hardware procurement platform · India</sub>
</p>
