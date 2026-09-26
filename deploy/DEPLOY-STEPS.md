# Patel Networks / MegaTech — VPS Deployment Runbook

Target: client-owned **Ubuntu 22.04/24.04 VPS (x86_64)**, Docker Compose stack:
`app` (Next.js 16 standalone) + `db` (PostgreSQL 16) + `nginx` (reverse proxy, 80/443).
**No Supabase / Firebase / managed DB** — everything runs on the client's box (Task 0).

Assumed public domain below: `patelnetworks.in` (replace everywhere).
Assumed clone path: `/opt/patelnetworks` (replace if different).

---

## 1. Install Docker (VPS)

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
# Docker Engine + compose plugin from the official repo:
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER" && newgrp docker   # or re-login
docker --version && docker compose version         # sanity check
```

## 2. Get the code (VPS)

```bash
sudo mkdir -p /opt/patelnetworks && sudo chown "$USER" /opt/patelnetworks
git clone <CLIENT_REPO_URL> /opt/patelnetworks
cd /opt/patelnetworks
```

## 3. Configure secrets — NEVER commit `.env`

```bash
cp .env.example .env
openssl rand -hex 32        # -> paste into JWT_SECRET (the code's session secret)
openssl rand -hex 16        # -> POSTGRES_PASSWORD (also fix DATABASE_URL to match)
openssl rand -hex 16        # -> RAZORPAY_WEBHOOK_SECRET (optional for now)
```

> Full walkthrough: **[ENV-SETUP.md](./ENV-SETUP.md)** — per-variable sources
> (Razorpay/Shiprocket/Fast2SMS/Meta dashboards), sim→live verification
> checklist, rotation procedures, and the symptom→variable troubleshooting map.

Edit `.env`:
- `DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@db:5432/<POSTGRES_DB>?schema=public` — host **must be `db`** (compose network), not localhost.
- `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (SUPER_ADMIN bootstrap on first `/admin/login`).
- `NEXT_PUBLIC_APP_URL=https://patelnetworks.in`.
- Payment/shipping/SMS/WhatsApp keys can stay **placeholder** → the app runs in deterministic simulation mode (sandbox checkout, `[SIMULATED SMS]` OTPs in `docker compose logs app`).

## 4. Build & start

```bash
docker compose up -d --build
docker compose ps                 # app + db + nginx, healthchecks green
docker compose logs -f app        # watch the entrypoint: schema sync, then server
```

What the app container does on start (`docker-entrypoint.sh`):
1. `RUN_MIGRATIONS=true` → `prisma db push --skip-generate` (repo has no `prisma/migrations/`; the entrypoint auto-switches to `prisma migrate deploy` if that folder is ever committed — schema is created fresh on the empty `pgdata` volume).
2. `exec node server.js` (standalone).

> Note: the sandbox repo schema says `provider = "sqlite"`. The **image build** switches it to `postgresql` in-image (Dockerfile, sed) — the repo file stays untouched. If you ever run Prisma from the host against Postgres, flip the provider line manually.

## 5. Verify

```bash
curl -fsS http://127.0.0.1/api/health     # via nginx
curl -fsS http://127.0.0.1:3000/api/health  # direct to app only if the debug port is published
```

Expect JSON `{"status":"healthy","db":"up",...}`. Then open `http://patelnetworks.in` once DNS is live.

First admin: log in at `/admin/login` with `ADMIN_EMAIL`/`ADMIN_PASSWORD` → SUPER_ADMIN is bootstrapped, then change the password.
Optional seed catalog: the builder-stage image has bun + full deps (`prisma/seed-images.json` is committed, so the seed runs as-is):
`docker build --target builder -t patel-builder . && docker run --rm --network patelnetworks_internal --env-file .env -v "$PWD/prisma:/app/prisma" patel-builder bun prisma/seed.ts`
(admin + products can also be managed from the admin console.)

> Fuller, checkpoint-by-checkpoint deployment guides: **[docs/VPS-SETUP-GUIDE.md](../docs/VPS-SETUP-GUIDE.md)**
> (cloud VPS) and **[docs/PHYSICAL-SERVER-SETUP-GUIDE.md](../docs/PHYSICAL-SERVER-SETUP-GUIDE.md)** (bare metal).
> A staging preview with auto-deploy on commit: **[docs/RENDER-DEPLOYMENT.md](../docs/RENDER-DEPLOYMENT.md)**.

## 6. DNS

At the registrar/host: `A @ -> VPS_IP`, `A www -> VPS_IP` (or CNAME to the apex). Wait for propagation: `dig +short patelnetworks.in`.

## 7. TLS via certbot (Let's Encrypt)

```bash
sudo apt-get install -y certbot
# 1) temporarily stop nginx so certbot can bind :80 standalone:
sudo systemctl stop nginx 2>/dev/null; docker compose stop nginx
sudo certbot certonly --standalone -d patelnetworks.in -d www.patelnetworks.in
# 2) make certs readable by the nginx container (path exists in repo: nginx/certs/):
sudo mkdir -p /opt/patelnetworks/nginx/certs/live
sudo cp -rL /etc/letsencrypt/live /opt/patelnetworks/nginx/certs/
sudo cp -rL /etc/letsencrypt/archive /opt/patelnetworks/nginx/certs/
# 3) edit nginx/conf.d/patel.conf: uncomment the 443 server block (ssl_certificate
#    paths point to /etc/nginx/certs/live/...), optionally switch :80 to redirect.
docker compose up -d nginx
curl -fsSI https://patelnetworks.in          # verify
```

Renewals: `sudo certbot renew --dry-run` + a cron/systemd-timer that re-copies certs and runs `docker compose exec nginx nginx -s reload` (or use the webroot variant documented at the bottom of `nginx/conf.d/patel.conf` to renew without stopping nginx).

## 8. Backups (mandatory per checklist)

```bash
./deploy/backup.sh     # ./backups/<db>_<timestamp>.sql.gz, 7-day retention
```

Daily cron (adjust path):
```
30 2 * * * cd /opt/patelnetworks && ./deploy/backup.sh >> ./backups/backup.log 2>&1
```
Copy archives off-VPS periodically (rclone/rsync to client storage) — a VPS lost with its backups is zero backups.

## 9. Update procedure (deploys)

```bash
cd /opt/patelnetworks
git pull
docker compose up -d --build          # rebuilds image, schema-syncs, restarts
docker compose logs -f app            # confirm entrypoint + no runtime errors
./deploy/backup.sh                    # snapshot right before/after any schema-touching change
```

Rollback: previous image is retained — `docker images`, then retag/run, or `git checkout <previous-tag> && docker compose up -d --build`.

## 10. Troubleshooting quick map

| Symptom | Check |
|---|---|
| `/api/health` returns `{"status":"degraded"}` | `docker compose logs db` — wrong POSTGRES_PASSWORD vs DATABASE_URL is the usual suspect |
| 502 from nginx | app crashed → `docker compose ps`, `docker compose logs app` |
| Cookies not Secure / redirect loops | ensure `X-Forwarded-Proto https` reaches the app (443 block uncommented, proxies set) |
| OTP not arriving | simulation mode is ON — OTP in `docker compose logs app` as `[SIMULATED SMS]` |
| Disk filling | old images: `docker image prune -f`; check `./backups` retention ran |
