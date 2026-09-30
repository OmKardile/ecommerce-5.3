# Deployment (client VPS, self-hosted)

Target: the client's own VPS running Docker Compose — **no Supabase, no Firebase, no managed DB** (client requirement; resolution C1/C8 in [DECISIONS.md](./DECISIONS.md)). The app is a single Next.js standalone container behind an nginx reverse proxy, with PostgreSQL in a container and optional redis/minio.

Status note: the deploy artifacts (`Dockerfile`, `docker-compose.yml`, `nginx/`, `.env.example`) are authored by infrastructure agent 3-b (tracked in `/worklog.md`). This document is the operational contract those files implement; where a file is not yet present, the "expected" description below is what to verify once 3-b lands it.

## Topology (docker-compose)

```
                internet
                   |
              :80/:443 (certbot TLS)
                   |
             [ nginx ]  reverse proxy, gzip, security headers, rate-limit zone
                   |  proxy_pass app:3000
             [ app ]    Next.js 16 standalone server (node/bun base image)
                   |  DATABASE_URL=postgresql://...
             [ postgres:16 ]  named volume pgdata
   optional:  [ redis ]  future cache/rate-limit store (app currently uses in-memory limiter)
   optional:  [ minio ]  S3-compatible bucket for product/label assets
```

Expected service shape (`docker-compose.yml`):

| Service | Image / build | Notes |
| --- | --- | --- |
| `app` | build from repo `Dockerfile` | `next build` standalone output; `PORT=3000`; depends_on postgres healthy; restart: unless-stopped |
| `postgres` | postgres:16-alpine | env `POSTGRES_DB/USER/PASSWORD`; named volume `pgdata:/var/lib/postgresql/data`; healthcheck `pg_isready`; restart: unless-stopped |
| `nginx` | nginx:alpine, mounts `./nginx/nginx.conf` + certs | listens 80/443, proxies to `app:3000`, restart: unless-stopped |
| `redis` (optional) | redis:7-alpine | reserved; the in-memory rate limiter is single-node by design |
| `minio` (optional) | minio/minio | product imagery / shipping label storage if not using the seed image bank |

The root `next.config.ts` already sets `output: "standalone"`, and the `build` script copies `.next/static` and `public` into `.next/standalone` so the standalone server is self-contained. `package.json` starts it with `NODE_ENV=production bun .next/standalone/server.js`; the container entrypoint should run the same server (node `server.js` also works).

## Build and deploy steps

```bash
# on the VPS, in the repo root
git pull
cp .env.example .env            # then edit: fill every REQUIRED var (see ENVIRONMENT.md)
docker compose build app
docker compose up -d
docker compose exec app sh -c "npx prisma db push"   # or db migrate (see below)
docker compose exec app sh -c "bun prisma/seed.ts"   # first deploy only (destructive!)
docker compose logs -f app      # sanity check
curl -s https://<domain>/api/health
```

Migrations on deploy: the project uses `prisma db push` in the sandbox; on the VPS either keep `db push` (schema-as-code, acceptable for this schema) or establish a baseline with `prisma migrate diff`/`migrate deploy`. Both work identically with this portable schema (ADR-021). Deploy ordering: build -> start postgres -> run push/migrate -> (re)start app so the server boots against the migrated schema.

First-boot admin: set `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` and log in once at `/admin/login` — the service bootstraps that SUPER_ADMIN on first login (auth.service `adminLogin`). Never rely on the seeded sandbox password in production.

## Healthchecks

- Endpoint: `GET /api/health` returns HTTP **200 in both states** with `{ok:true,data:{status:'healthy'|'degraded', db:'up'|'down', time}}` (it performs a `SELECT 1`).
- Container healthcheck must therefore inspect the body, e.g.:
  `curl -fsS http://localhost:3000/api/health | grep -q '"status":"healthy"'` — a `degraded` body (db down) should mark the container unhealthy.
- nginx should keep `proxy_read_timeout` >= 60s and pass `X-Forwarded-For`/`X-Forwarded-Proto` (the app's `clientIp()` rate limiter keys on `x-forwarded-for`).

## Backups

- Primary: nightly `pg_dump` of the app database via cron on the host (or a one-shot compose sidecar):
  `0 2 * * * docker compose -f /srv/patel/docker-compose.yml exec -T postgres pg_dump -U <user> <db> | gzip > /srv/backups/patel-$(date +\%F).sql.gz`
- Retain 7 daily + 4 weekly + 12 monthly; copy off-box (object storage or another machine) weekly.
- Volumes to protect (expected compose volumes): `pgdata` (postgres data), optional `minio-data`, the `.env` file (secrets — never committed), and any mounted `prisma/seed-images.json` asset folder.
- Test restores quarterly: `gunzip -c <dump>.sql.gz | docker compose exec -T postgres psql -U <user> -d <db>`.

## Logs

- The standalone server logs to stdout/stderr: `docker compose logs -f app` (or ship to the host via the `json-file` driver with rotation, e.g. `max-size: 10m`, `max-file: 5`).
- `[SIMULATED SMS]`/`[SIMULATED WHATSAPP]` lines in production logs mean the SMS/WhatsApp credentials are missing/placeholder — fix the env, that is not expected on the live site.
- Application audit trail lives in the `audit_logs` table (admin actions, order events, shipment scans, notification dispatches) — back it up with the DB dumps.
- `dev.log` / `server.log` tee-ing is a sandbox convenience only; do not rely on file logs in Docker.

## Restart policies and resilience

- All services: `restart: unless-stopped` (postgres also survives host reboots with the named volume).
- The app is stateless besides the DB; scaling to a second app container requires moving the rate limiter to redis (the memory store is per-process).
- nginx `client_max_body_size` 2-5m is sufficient (CSV inventory imports are small).

## SSL via certbot

- Expected: certbot issues/renews a Let's Encrypt cert for the store domain, either as a sidecar (`certbot/certbot` with webroot `./certbot/www`) or on the host; nginx mounts `./certbot/conf` + `./certbot/www`.
- HTTP (80) serves only the ACME challenge and redirects to HTTPS; the app sets session cookies with `secure` in production so HTTPS is mandatory before go-live.
- After renew: `docker compose exec nginx nginx -s reload`.

## Environment wiring

All runtime configuration is environment-only; **no secrets live in the repo** (`.env` is gitignored; `.env.example` documents keys with placeholder values only). Minimum production set: `DATABASE_URL` (Postgres), `JWT_SECRET` (32+ random bytes), `NEXT_PUBLIC_APP_URL` (public https URL), real `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET`, real Shiprocket (or Delhivery) credentials, real `SMS_GATEWAY_API_KEY` (+ sender/template), WhatsApp token + phone id + verify token, and `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Placeholder or missing gateway keys silently switch that subsystem to simulation (see [ENVIRONMENT.md](./ENVIRONMENT.md)) — verify each in the post-deploy smoke test:

1. `/api/health` -> `healthy`
2. OTP login of a real phone (SMS arrives, no `[SIMULATED SMS]` in logs)
3. Test prepaid order -> real Razorpay checkout -> webhook received (check `payment_events`)
4. Admin AWB booking -> real provider shipment (not `SR-SIM-`/`DELH`-hex)
5. `robots.txt`/`sitemap.xml` show the production domain (`NEXT_PUBLIC_APP_URL`)
