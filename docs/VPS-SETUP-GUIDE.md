# Patel Networks — VPS Setup Guide (5.3)

> **Note**: the client may also deploy on their own **physical server** instead of a VPS. See [`PHYSICAL-SERVER-SETUP-GUIDE.md`](./PHYSICAL-SERVER-SETUP-GUIDE.md) for that path (hardware specs, OS installation, remote SSH, BIOS configuration, power-cut resilience).
>
> This guide covers the **VPS path** — for when the client prefers a cloud-hosted virtual machine over bare metal.
>
> **Single source of truth** for deploying the Patel Networks / MegaTechzy storefront on the client's own Ubuntu VPS with Docker Compose. No Supabase, no Firebase, no managed DB, no pm2 — exactly three containers.
>
> This guide is the expanded, checkpointed version of [`deploy/DEPLOY-STEPS.md`](../deploy/DEPLOY-STEPS.md) (the terse runbook). Commands are kept identical to it — if you only need the short version, use that file.
>
> **Read this entire document once before running any command.**
> Each phase has a ✅ checkpoint. Do not proceed until the checkpoint passes.

---

## Table of Contents

1. [What you need before starting](#1-what-you-need-before-starting)
2. [Architecture overview](#2-architecture-overview)
3. [Phase A — Prepare the VPS](#phase-a--prepare-the-vps)
4. [Phase B — Code + `.env`](#phase-b--code--env)
5. [Phase C — Build & start the stack](#phase-c--build--start-the-stack)
6. [Phase D — Verify the app](#phase-d--verify-the-app)
7. [Phase E — DNS](#phase-e--dns)
8. [Phase F — TLS via certbot](#phase-f--tls-via-certbot)
9. [Phase G — Automated backups](#phase-g--automated-backups)
10. [Phase H — Firewall & hardening](#phase-h--firewall--hardening)
11. [Phase I — Final validation & update procedure](#phase-i--final-validation--update-procedure)
12. [Troubleshooting](#troubleshooting)
13. [Rollback procedure](#rollback-procedure)
14. [Quick reference — the commands that matter](#quick-reference--the-commands-that-matter)
15. [Official reference links](#official-reference-links)

---

## 1. What you need before starting

| Item | Why | How to get it |
|---|---|---|
| A VPS (root or sudo user) | Hosts all three containers (nginx + app + db) | Hetzner / DigitalOcean / Linode / AWS Lightsail — **2 vCPU / 4 GB RAM minimum** |
| VPS OS | Docker compatibility | **Ubuntu 22.04 or 24.04 LTS** recommended |
| SSH client + key | The only way into the box | `ssh root@VPS_IP` (or a sudo user — recommended) |
| Domain name (optional but recommended) | HTTPS + production URL | Point DNS A record(s) to the VPS public IP (Phase E) |
| The latest `deploy/backup.sh` archive | Only if migrating an **existing** production box (Phase C.4) | Produced by the old box's daily backup cron |
| ~30–45 minutes | Total setup time | — |

**You do NOT need**: a managed database, Supabase, Firebase, a connection pooler, Node.js/Bun/pm2 installed on the host, or any paid third-party service. Everything runs on the VPS in three Docker containers.

---

## 2. Architecture overview

```
                     Internet
                        │
                        ▼
               ┌─────────────────┐
               │ nginx :80/:443  │  ← TLS termination (certbot certs), reverse proxy
               │ (nginx:alpine)  │    the ONLY service published to the host
               └────────┬────────┘
                        │ app:3000  (compose network `internal`)
                        ▼
               ┌─────────────────┐
               │      app        │  ← Next.js 16 standalone (node:22-slim, non-root)
               │ (built image)   │    entrypoint: schema sync → exec node server.js
               └────────┬────────┘
                        │ db:5432
                        ▼
               ┌─────────────────┐
               │       db        │  ← postgres:16-alpine
               │  pgdata volume  │    port NOT published — not even to localhost
               └─────────────────┘
```

All three services live on one Docker bridge network named `internal` (compose project name `patelnetworks`, so the network resolves as `patelnetworks_internal`). Only nginx exposes ports (80/443).

| Service | Image | Host ports | Persistence |
|---|---|---|---|
| `nginx` | nginx:alpine (prebuilt) | **80, 443** | none (config + certs bind-mounted read-only) |
| `app` | built from the committed `Dockerfile` (oven/bun:1 deps → oven/bun:1 builder → node:22-slim runner, non-root) | none | none (stateless) |
| `db` | postgres:16-alpine | none (deliberately) | named volume `pgdata` |

> **Why there is no PgBouncer (difference from 5.2):** the older architecture sat a PgBouncer pooler between app and PostgreSQL and used two connection URLs (`DATABASE_URL` on :6432, `DIRECT_URL` on :5432). In 5.3 the app and the database are two containers on the same compose-internal network with a low, fixed connection count — the extra hop, the extra container, and the dual-URL pairing buy nothing. There is a **single `DATABASE_URL`** whose host must be `db` (the compose service name). There is no `DIRECT_URL` at all.

- **Next.js 16** production build runs as a standalone Node server inside its container — the committed `Dockerfile` does `bun install` → `prisma generate` + `next build` (Bun, inside the builder stage) → `node:22-slim` runner. Nothing Node-related is installed on the host.
- On boot, `docker-entrypoint.sh` syncs the schema (`prisma db push --skip-generate`; auto-switches to `prisma migrate deploy` the day `prisma/migrations/` is committed) and then `exec node server.js`.
- **nginx** terminates TLS (certs from certbot, Phase F), proxies to `app:3000`, and sets `X-Forwarded-*` headers (required for Secure cookies and client IPs).
- **Backups** via cron + `deploy/backup.sh` (Phase G).

---

## Phase A — Prepare the VPS

### A.1 SSH into the VPS

```bash
ssh root@YOUR_VPS_IP
# or: ssh deploy@YOUR_VPS_IP   (recommended: use a non-root sudo user)
```

### A.2 Update the system

```bash
sudo apt update && sudo apt upgrade -y
```

### A.3 Install Docker + Docker Compose

```bash
# Docker Engine + the compose plugin, from the official repo:
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group (so you don't need sudo every time)
sudo usermod -aG docker "$USER"
newgrp docker   # apply the group change immediately (or re-login)

# Verify
docker --version          # Docker 24+
docker compose version    # Compose v2
```

> **Difference from 5.2:** the old guide installed Node.js 20, Bun, and pm2 on the host here (phases A.4/A.5). **5.3 needs none of that** — Bun runs inside the image's builder stage, Node 22 runs inside the runner image, and `restart: unless-stopped` in `docker-compose.yml` replaces pm2 entirely. The host runs Docker and nothing else.

### A.4 (Optional) Cloud firewall

If your provider offers an external cloud firewall (Hetzner Cloud Firewalls, DigitalOcean Cloud Firewalls, Lightsail networking tab), allow **22/TCP, 80/TCP, 443/TCP** there too. If none is configured, the OS-level UFW in Phase H is the only firewall.

✅ **Checkpoint A**: `docker run hello-world` prints a success message.

---

## Phase B — Code + `.env`

### B.1 Get the project code onto the VPS

```bash
sudo mkdir -p /opt/patelnetworks && sudo chown "$USER" /opt/patelnetworks
git clone https://github.com/OmKardile/patel-networks.git /opt/patelnetworks
cd /opt/patelnetworks
```

(Or transfer the repo with `scp -r` from the dev machine if the client prefers not to pull from GitHub.)

### B.2 Create the `.env` file

```bash
cd /opt/patelnetworks
cp .env.example .env
nano .env
```

Generate the secrets first:

```bash
openssl rand -hex 16        # → POSTGRES_PASSWORD
openssl rand -hex 32        # → JWT_SECRET
openssl rand -base64 18     # → ADMIN_PASSWORD
```

Fill in the essentials (the template's comments document every variable):

```bash
# --- database — host MUST be `db`, the compose service name ---
DATABASE_URL="postgresql://patel:<POSTGRES_PASSWORD>@db:5432/patelnetworks?schema=public"
POSTGRES_USER=patel
POSTGRES_PASSWORD=<the hex value you generated>
POSTGRES_DB=patelnetworks

# --- sessions + OTP hashing (REQUIRED in production) ---
JWT_SECRET=<the 32-byte hex value>

# --- first admin bootstrap (created on the first /admin/login submit) ---
ADMIN_EMAIL=admin@patelnetworks.in
ADMIN_PASSWORD=<the base64 value>

# --- public origin — SET BEFORE THE FIRST IMAGE BUILD (see B.3) ---
NEXT_PUBLIC_APP_URL=https://patelnetworks.in

# --- schema-sync gate (keep true) ---
RUN_MIGRATIONS=true

# Everything else — Razorpay / Shiprocket / SMS / WhatsApp — leave UNSET.
# The app then runs in deterministic simulation mode:
#   payments → orders named order_sim_*, sandbox-only /api/payments/razorpay/simulate
#   shipping → deterministic AWBs (DELH<10hex>)
#   SMS/OTP  → `[SIMULATED SMS] … OTP: <code>` in `docker compose logs app`
```

> ⚠️ **Critical**: `DATABASE_URL`'s host must be **`db`** — not `localhost`, not `127.0.0.1`. Inside the app container, `localhost` does not reach Postgres; this is the **#1 cause** of `{"status":"degraded"}` health checks. The password inside `DATABASE_URL` must exactly match `POSTGRES_PASSWORD`.

Full per-variable walkthrough: [`deploy/ENV-SETUP.md`](../deploy/ENV-SETUP.md) (fill-in order, credential sources, sim→live verification, rotation).

### B.3 Set the build-time origin

`NEXT_PUBLIC_APP_URL` is the only build-time variable that matters: Next.js inlines `NEXT_PUBLIC_*` into client bundles, and the Dockerfile receives it as a build **arg** (default `http://localhost:3000`). Before the **first** build, uncomment the `args:` block in `docker-compose.yml` and set your real origin:

```yaml
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_APP_URL: https://patelnetworks.in
```

Runtime reads (`metadataBase`, `sitemap.xml`, `robots.txt`, canonicals) come from `.env` at any time — but client bundles keep whatever was baked in at build time, so changing the origin later means rebuilding (see Phase I).

✅ **Checkpoint B**: `grep -E 'DATABASE_URL|POSTGRES_PASSWORD' .env` — the URL host is `db:5432` and the password inside the URL matches `POSTGRES_PASSWORD` exactly.

---

## Phase C — Build & start the stack

### C.1 Build + start (three containers)

```bash
cd /opt/patelnetworks
docker compose up -d --build
```

The first build takes roughly 5–15 minutes (it pulls `oven/bun:1`, `node:22-slim`, `postgres:16-alpine`, `nginx:alpine`, then installs deps and runs `next build`).

> **Low-RAM box (4 GB)?** If the build is OOM-killed, add swap first (see [Troubleshooting](#troubleshooting) → "Build is OOM-killed") or build the image on a dev machine and load it onto the VPS with `docker save | docker load`.

### C.2 Confirm health + watch the entrypoint

```bash
docker compose ps
# app   → healthy (healthcheck has a 40s start period — give it a minute)
# db    → healthy (pg_isready)
# nginx → Up (no healthcheck; "Up" is normal)

docker compose logs -f app
```

Expected entrypoint output:

```
[entrypoint] Patel Networks app starting (NODE_ENV=production PORT=3000)
[entrypoint] RUN_MIGRATIONS=true -> syncing database schema
[entrypoint] no prisma/migrations dir -> prisma db push --skip-generate
[entrypoint] schema sync done
[entrypoint] exec node server.js
```

### C.3 Fresh box — load the demo/launch catalog (seed)

Skip this if you are restoring existing production data (C.4). To populate categories, products, SKUs, banners, blog posts and the staff users from the seed:

```bash
# The builder stage of the image has bun + the full dependency tree:
docker build --target builder -t patel-builder .
docker run --rm --network patelnetworks_internal --env-file .env \
  -v "$PWD/prisma:/app/prisma" patel-builder bun prisma/seed.ts
```

Notes:

- `prisma/seed-images.json` **is committed** in this repo, and the seed imagery ships in the image — the seed runs clean end to end.
- The seed's default superadmin is `superadmin@patelnetworks.in` / `patel@admin2026`. **If `ADMIN_EMAIL`/`ADMIN_PASSWORD` are set in `.env` before seeding, they override the seed admin** — on a public host, always set them (you did, in Phase B).
- Products/admin content can also be managed later from the admin console; re-run the seed any time to reset to the demo catalog (it is destructive to existing data).

### C.4 Existing production box — restore from a backup archive

If this VPS replaces a box that already ran the store, bring the data over by restoring the newest `deploy/backup.sh` archive (a plain-SQL `pg_dump` produced with `--clean --if-exists`, so it resets tables before loading):

```bash
# Copy the archive up from the old machine (or your offsite storage):
scp old-box:/opt/patelnetworks/backups/patelnetworks_<ts>.sql.gz /tmp/

# Restore (match POSTGRES_USER / POSTGRES_DB from your .env):
gunzip -c /tmp/patelnetworks_<ts>.sql.gz | \
  docker compose exec -T db psql -U patel -d patelnetworks
```

Run it after the stack is up (the entrypoint has already schema-synced the empty volume; the dump then drops/recreates and loads the real data).

✅ **Checkpoint C**: `docker compose ps` shows app + db healthy and nginx Up, and the app log shows `schema sync done` followed by `exec node server.js` with no error lines after it.

---

## Phase D — Verify the app

### D.1 Health + homepage

```bash
curl -fsS http://127.0.0.1/api/health
# Expected: {"status":"healthy","db":"up","time":"..."}
# If you get {"status":"degraded",...} → Troubleshooting (DATABASE_URL / password mismatch).

curl -fsS http://127.0.0.1/ | grep -o '<title>[^<]*</title>'
# Expected: the Patel Networks storefront <title> (via nginx → app).
```

### D.2 Route smoke test

```bash
for r in / /products /kit-builder /admin/login; do
  printf "%-14s %s\n" "$r" "$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1$r)"
done
# all four lines should print 200
```

### D.3 Bootstrap the first admin

Open `http://<VPS_IP>/admin/login` (HTTPS comes in Phase F) and submit the `ADMIN_EMAIL`/`ADMIN_PASSWORD` pair from `.env` once — the first submit bootstraps that account as **SUPER_ADMIN**. Then:

- Change the password after logging in.
- If you seeded (C.3) and did **not** set `ADMIN_EMAIL`/`ADMIN_PASSWORD`, the seed default (`superadmin@patelnetworks.in` / `patel@admin2026`) is live — change it immediately; never leave seed credentials on a public host.

✅ **Checkpoint D**: health JSON says `healthy` / `db: up`, homepage title renders, all four smoke routes return 200, and you can log into `/admin`.

---

## Phase E — DNS

At the registrar/DNS host:

| Record | Type | Value |
|---|---|---|
| `@` (apex) | A | `YOUR_VPS_IP` |
| `www` | A (or CNAME → apex) | `YOUR_VPS_IP` |

Wait for propagation and verify:

```bash
dig +short patelnetworks.in
dig +short www.patelnetworks.in
# Both should print the VPS IP.
```

> **Cloudflare note**: if the domain is proxied through Cloudflare, set the records to **DNS-only (grey cloud)** until the certificate is issued in Phase F — the certbot HTTP-01 challenge must reach this VPS directly. You can switch the proxy on afterwards.

✅ **Checkpoint E**: `dig +short patelnetworks.in` (queried against an external resolver, e.g. `dig @1.1.1.1`) returns the VPS IP.

---

## Phase F — TLS via certbot

nginx terminates TLS using Let's Encrypt certificates issued by **certbot on the host** (5.2 used Caddy with automatic HTTPS — 5.3 uses nginx + certbot instead; nginx cannot request certs by itself).

### F.1 Install certbot + issue the first certificate

```bash
sudo apt-get install -y certbot

# 1) Free port 80 — certbot's standalone mode must bind it for the challenge:
sudo systemctl stop nginx 2>/dev/null; docker compose stop nginx

# 2) Issue the cert (DNS from Phase E must already point here):
sudo certbot certonly --standalone -d patelnetworks.in -d www.patelnetworks.in

# 3) Copy live + archive into the mounted certs folder
#    (-L dereferences the symlinks in /etc/letsencrypt/live):
sudo cp -rL /etc/letsencrypt/live /opt/patelnetworks/nginx/certs/
sudo cp -rL /etc/letsencrypt/archive /opt/patelnetworks/nginx/certs/
```

### F.2 Enable the HTTPS server block

Edit `nginx/conf.d/patel.conf`:

1. **Uncomment the entire `server { listen 443 ssl; … }` block** at the bottom.
2. Set `server_name patelnetworks.in www.patelnetworks.in;` to your domain.
3. **Point the cert paths at the certs folder** — the template ships with `/etc/letsencrypt/...` paths (for the alternative letsencrypt-mount setup); with the certs folder from F.1 they must read:
   ```nginx
   ssl_certificate     /etc/nginx/certs/live/patelnetworks.in/fullchain.pem;
   ssl_certificate_key /etc/nginx/certs/live/patelnetworks.in/privkey.pem;
   ```
4. Optionally convert the `:80` block into a plain redirect to HTTPS (keep the ACME location if you later use the webroot renewal variant).

### F.3 Restart nginx + verify

```bash
docker compose up -d nginx
curl -fsSI https://patelnetworks.in        # HTTP/2 200 with a valid cert
```

✅ **Checkpoint F**: `curl -fsSI https://patelnetworks.in` returns `200` and the browser padlock shows a valid Let's Encrypt certificate.

### F.4 Renewals

Let's Encrypt certs last 90 days. Test renewal now:

```bash
sudo certbot renew --dry-run
```

With the standalone authenticator, renewal needs port 80 free, so run the whole cycle on a maintenance schedule (root crontab, `sudo crontab -e` — note the `;` separators so nginx always comes back even if renewal fails):

```cron
17 3 * * 1 cd /opt/patelnetworks && docker compose stop nginx; certbot renew --quiet; cp -rL /etc/letsencrypt/live nginx/certs/; cp -rL /etc/letsencrypt/archive nginx/certs/; docker compose up -d nginx >> /var/log/patel-tls.log 2>&1
```

Every Monday 03:17 it stops nginx for a few seconds, renews only if due (certs renew around day 60), re-copies, and starts nginx again. **Zero-downtime alternative**: the webroot variant documented at the bottom of `nginx/conf.d/patel.conf` — uncomment the ACME challenge location + the `certbot-www`/`certbot-conf` volumes in `docker-compose.yml`, issue/renew with `certbot certonly --webroot -w /opt/patelnetworks/nginx/certbot-www …`, and only re-copy + `docker compose exec nginx nginx -s reload` are needed (no stop/start).

---

## Phase G — Automated backups

### G.1 Test the backup script

```bash
cd /opt/patelnetworks
./deploy/backup.sh
ls -lh backups/    # → patelnetworks_<timestamp>.sql.gz
```

The script dumps the database through `pg_dump` inside the `db` container into `./backups/<db>_<timestamp>.sql.gz` and prunes anything older than **7 days** (retention configurable at the top of the script).

### G.2 Schedule it daily (cron)

```bash
sudo crontab -e
```

```cron
30 2 * * * cd /opt/patelnetworks && ./deploy/backup.sh >> ./backups/backup.log 2>&1
```

### G.3 Copy archives off the VPS

A VPS lost together with its backups is zero backups. Ship the `backups/` folder somewhere else daily:

```cron
45 2 * * * rsync -a /opt/patelnetworks/backups/ backup-user@backup-host:/backups/patelnetworks/
# or use rclone to any cloud storage: rclone copy /opt/patelnetworks/backups/ remote:patelnetworks-backups
```

Quarterly, do one restore drill (per the production checklist):

```bash
gunzip -c backups/<file>.sql.gz | docker compose exec -T db psql -U patel -d patelnetworks
```

✅ **Checkpoint G**: a fresh `.sql.gz` exists in `./backups/`, the cron line is installed, and an offsite copy target is configured.

---

## Phase H — Firewall & hardening

### H.1 UFW — allow only SSH + web

```bash
sudo apt install -y ufw
sudo ufw allow 22/tcp     # SSH — don't lock yourself out
sudo ufw allow 80/tcp     # HTTP (ACME challenges + redirect)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable
sudo ufw status verbose
```

> **Docker + UFW nuance**: Docker inserts its own iptables rules, so UFW does not filter ports published by containers. That is fine here because only nginx is published (80/443 — which we want public). The `app` and `db` services publish **nothing**: 5432 is not bound on the host at all. Verify:
> ```bash
> sudo ss -tlnp | grep -E ':3000|:5432'    # should print nothing
> ```

### H.2 (Optional) SSH key-only auth + fail2ban

```bash
# Add your public key to ~/.ssh/authorized_keys first, then:
sudo nano /etc/ssh/sshd_config
#   PasswordAuthentication no
#   PermitRootLogin prohibit-password   (or: no)
sudo systemctl restart ssh
# Keep the current session open and test login in a NEW terminal before closing it.

sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd    # jail should be active
```

### H.3 (Optional) Automatic security updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades   # answer Yes
```

✅ **Checkpoint H**: `sudo ufw status` shows only 22/80/443 allowed, nothing listens on 3000/5432 on the host, SSH still works.

---

## Phase I — Final validation & update procedure

### I.1 Full validation sweep

```bash
cd /opt/patelnetworks
curl -fsS https://patelnetworks.in/api/health            # {"status":"healthy","db":"up",...}
curl -fsS https://patelnetworks.in/ | grep -o '<title>[^<]*</title>'
for r in / /products /kit-builder /admin/login; do
  printf "%-14s %s\n" "$r" "$(curl -fsS -o /dev/null -w '%{http_code}' https://patelnetworks.in$r)"
done                                                      # all 200
docker compose ps                                         # app+db healthy, nginx Up
sudo ufw status                                           # 22/80/443 only
df -h /                                                   # comfortable disk headroom
./deploy/backup.sh                                        # one fresh archive
```

Typecheck/lint (`bun run typecheck`, `bun run lint`) run on the dev machine/CI — the host has no Node/Bun toolchain by design (5.2 ran them on the server; 5.3 hosts are container-only).

### I.2 Deploying updates

```bash
cd /opt/patelnetworks
./deploy/backup.sh                    # snapshot before any schema-touching change
git pull
docker compose up -d --build          # rebuilds the image, entrypoint re-syncs the schema
docker compose logs -f app            # confirm entrypoint lines + no runtime errors
```

Keep a known-good image tag before every update so rollback is instant (see [Rollback](#rollback-procedure)):

```bash
docker tag patelnetworks-app:latest patelnetworks-app:prev
```

Remember: if `NEXT_PUBLIC_APP_URL` ever changes, rebuild the image (`docker compose up -d --build`) — client bundles keep the build-time value otherwise.

✅ **Checkpoint I (final)**: the app is live at `https://patelnetworks.in`, backups are scheduled + offsite, the firewall is up, and the update flow has been exercised once.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| `/api/health` → `{"status":"degraded"}` | `docker compose logs db` — `POSTGRES_PASSWORD` vs the password inside `DATABASE_URL` mismatch, **or** the URL host is not `db` (e.g. `localhost`). Fix `.env`, then `docker compose up -d` so both containers re-read it. |
| 502 from nginx | app crashed → `docker compose ps`, `docker compose logs app --tail 50`. Usually a bad `.env` value or a failed schema sync. |
| Login loops / cookies not Secure / wrong canonical URLs | nginx must send `X-Forwarded-Proto https` (443 block uncommented, proxy headers present) **and** `NEXT_PUBLIC_APP_URL` must match the live origin (rebuild if changed after the first build). |
| certbot: "Problem binding to port 80" | nginx still running → `docker compose stop nginx` (and `sudo systemctl stop nginx` if a host nginx was ever installed); check the provider firewall allows inbound 80. |
| OTP "never arrives" | Simulation mode is on by design — the OTP is in `docker compose logs app` as `[SIMULATED SMS] … OTP: <code>`. Real OTPs require the `SMS_*` trio (see `deploy/ENV-SETUP.md` §3). |
| Orders named `order_sim_*`, AWBs `DELH…` | Same reason — payments/shipping keys unset → deterministic simulation. Not a bug. |
| Disk filling up | `docker image prune -f` (old build layers), `docker system df`, confirm the backup retention sweep ran (`backups/backup.log`), prune `backups/` if retention was changed. |
| `docker compose` command not found | Old Docker install — use `docker-compose` (hyphen) as a fallback, or upgrade via `curl -fsSL https://get.docker.com \| sudo sh`. |
| Build is OOM-killed (4 GB box) | Add 4 GB swap: `sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` + `/swapfile none swap sw 0 0` in `/etc/fstab`. Or build the image on a dev machine: `docker build -t patelnetworks-app:latest .`, `docker save patelnetworks-app:latest \| gzip > app.tar.gz`, `docker load < app.tar.gz` on the VPS, then `docker compose up -d --no-build`. |
| Seed fails: "network patelnetworks_internal not found" | The stack must be up first — `docker compose up -d` creates the network; then re-run the seed command. |
| App restart-loop after deploy | `docker compose logs app` — typically the schema sync failed (db unreachable / bad `DATABASE_URL`) and the entrypoint exits. Fix `.env`, `docker compose up -d`. |
| Admin login "Invalid credentials" on a fresh box | `ADMIN_EMAIL`/`ADMIN_PASSWORD` unset (bootstrap never fires), or that email already exists (bootstrap is skipped once it does). See `deploy/ENV-SETUP.md` §6. |

---

## Rollback procedure

1. **App image (fastest, no rebuild):** before each update you tagged the known-good image:
   ```bash
   docker tag patelnetworks-app:prev patelnetworks-app:latest
   docker compose up -d --force-recreate --no-build app
   ```
2. **Source rollback:** `git checkout <previous-tag-or-sha> && docker compose up -d --build` (rebuilds the previous code; takes a few minutes).
3. **Database rollback:** if a schema-touching update corrupted data, restore the newest pre-update archive:
   ```bash
   gunzip -c backups/patelnetworks_<ts>.sql.gz | docker compose exec -T db psql -U patel -d patelnetworks
   ```
   Then re-deploy the previous app version (step 1 or 2) so code and schema match again.
4. Old images are retained automatically until pruned — `docker images` lists what is available.

---

## Quick reference — the commands that matter

```bash
# 1. Install Docker (the ONLY thing the host needs — no Node/Bun/pm2 in 5.3)
curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker "$USER" && newgrp docker

# 2. Code + env (host MUST be `db` in DATABASE_URL)
cd /opt && git clone https://github.com/OmKardile/patel-networks.git patelnetworks \
  && cd patelnetworks && cp .env.example .env && nano .env

# 3. Build + start the 3-container stack
docker compose up -d --build && docker compose ps && docker compose logs -f app

# 4. Health + smoke
curl -fsS http://127.0.0.1/api/health
for r in / /products /kit-builder /admin/login; do curl -fsS -o /dev/null -w "%{http_code} $r\n" http://127.0.0.1$r; done

# 5. Seed the launch catalog (fresh box) — builder image carries bun + deps
docker build --target builder -t patel-builder . && docker run --rm --network patelnetworks_internal \
  --env-file .env -v "$PWD/prisma:/app/prisma" patel-builder bun prisma/seed.ts

# 6. …or restore existing data from a backup archive
gunzip -c backups/patelnetworks_<ts>.sql.gz | docker compose exec -T db psql -U patel -d patelnetworks

# 7. TLS (first issue — then the renewal cron from Phase F.4)
docker compose stop nginx && sudo certbot certonly --standalone -d patelnetworks.in -d www.patelnetworks.in \
  && sudo cp -rL /etc/letsencrypt/live nginx/certs/ && sudo cp -rL /etc/letsencrypt/archive nginx/certs/ \
  && docker compose up -d nginx

# 8. Firewall
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable

# 9. Backups + daily cron
./deploy/backup.sh
echo "30 2 * * * cd /opt/patelnetworks && ./deploy/backup.sh >> ./backups/backup.log 2>&1" | sudo crontab -

# 10. Update
./deploy/backup.sh && docker tag patelnetworks-app:latest patelnetworks-app:prev \
  && git pull && docker compose up -d --build && docker compose logs -f app

# 11. Rollback
docker tag patelnetworks-app:prev patelnetworks-app:latest \
  && docker compose up -d --force-recreate --no-build app
```

---

## Official reference links

> Authoritative documentation for every tool used in this guide. Bookmark these.

### Core stack

| Tool | What it does | Official docs |
|---|---|---|
| **Next.js 16** | The application framework | https://nextjs.org/docs |
| **Prisma 6** | Database ORM | https://www.prisma.io/docs |
| **PostgreSQL 16** | The database | https://www.postgresql.org/docs/16/ |
| **Node.js 22** | Runtime of the runner image | https://nodejs.org/en/docs/ |
| **Bun** | Deps + build inside the builder stage | https://bun.sh/docs |

### Infrastructure

| Tool | What it does | Official docs |
|---|---|---|
| **Docker Engine** | Container runtime | https://docs.docker.com/engine/ |
| **Docker Compose** | Multi-container orchestration | https://docs.docker.com/compose/ |
| **nginx** | Reverse proxy + TLS termination | https://nginx.org/en/docs/ |
| **certbot** | Let's Encrypt certificate issuance/renewal | https://certbot.eff.org/ |
| **Ubuntu Server** | The OS | https://ubuntu.com/server/docs |
| **UFW (Uncomplicated Firewall)** | Host firewall | https://help.ubuntu.com/community/UFW |
| **fail2ban** | SSH brute-force protection | https://github.com/fail2ban/fail2ban/wiki |
| **pg_dump** | Database backup (`deploy/backup.sh`) | https://www.postgresql.org/docs/16/app-pgdump.html |
| **psql** | Restore / ad-hoc queries | https://www.postgresql.org/docs/16/app-psql.html |

### Cloud / DNS (if using a VPS provider)

| Service | Official link |
|---|---|
| Hetzner Cloud | https://docs.hetzner.com/cloud/ |
| DigitalOcean | https://docs.digitalocean.com/ |
| Linode | https://www.linode.com/docs/ |
| AWS Lightsail | https://lightsail.aws.amazon.com/ls/docs/ |
| Let's Encrypt | https://letsencrypt.org/getting-started/ |
| DuckDNS (dynamic DNS) | https://www.duckdns.org/ |
| Cloudflare (DNS + CDN, optional) | https://developers.cloudflare.com/ |

### Security

| Resource | Link |
|---|---|
| OpenSSH config reference | https://www.openssh.com/manual.html |
| GitHub Personal Access Tokens (for `git pull` on the VPS) | https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens |
| BFG Repo-Cleaner (purge secrets from git history) | https://rtyley.github.io/bfg-repo-cleaner/ |

---

<p align="center"><em>A project — authored by <a href="https://omkardile.is-a.dev/">Omkar Kardile</a> — Patel Networks / MegaTechzy</em><br/><sub>Surveillance hardware procurement platform · India</sub></p>
