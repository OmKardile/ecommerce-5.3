# Patel Networks — Physical Server Setup Guide (5.3)

> **Note**: if the client prefers a **cloud VPS** instead of a physical server, see [`VPS-SETUP-GUIDE.md`](./VPS-SETUP-GUIDE.md) for that path (shorter — the provider handles hardware + OS).
>
> This guide covers the **physical server (bare metal) path** — hardware selection → OS installation → remote SSH access → full application deployment → power-cut resilience.
>
> **Complete guide** for deploying the Patel Networks / MegaTechzy storefront on the client's own hardware. Exactly three Docker containers — no Supabase, no managed DB, no pm2.
>
> **Read this entire document once before starting.** Each phase has a ✅ checkpoint.
>
> The terse cloud runbook [`deploy/DEPLOY-STEPS.md`](../deploy/DEPLOY-STEPS.md) implements the same application stack; the phases below add everything bare metal needs around it. Commands are kept identical to it.

---

## Table of Contents

1. [Hardware requirements](#1-hardware-requirements)
2. [Architecture overview](#2-architecture-overview)
3. [Phase A — Install the operating system](#phase-a--install-the-operating-system)
4. [Phase B — Post-install: updates + deploy user](#phase-b--post-install-updates--deploy-user)
5. [Phase C — Remote SSH access setup](#phase-c--remote-ssh-access-setup)
6. [Phase D — Network configuration (static IP + firewall + port forwarding)](#phase-d--network-configuration-static-ip--firewall--port-forwarding)
7. [Phase E — Install Docker](#phase-e--install-docker)
8. [Phase F — Deploy the application stack](#phase-f--deploy-the-application-stack)
9. [Phase G — Verify the app + first admin bootstrap](#phase-g--verify-the-app--first-admin-bootstrap)
10. [Phase H — TLS via certbot](#phase-h--tls-via-certbot)
11. [Phase I — Automated backups](#phase-i--automated-backups)
12. [Phase J — Security hardening](#phase-j--security-hardening)
13. [Phase K — Monitoring basics](#phase-k--monitoring-basics)
14. [Phase L — Power-cut resilience & boot order](#phase-l--power-cut-resilience--boot-order)
15. [Phase M — Final validation & cutover](#phase-m--final-validation--cutover)
16. [Troubleshooting](#troubleshooting)
17. [Rollback procedure](#rollback-procedure)
18. [Quick reference — the 12 commands](#quick-reference--the-12-commands)
19. [What you need before starting](#what-you-need-before-starting)
20. [Official reference links](#official-reference-links)

---

## 1. Hardware requirements

### Minimum (testing / <10 concurrent users)

| Component | Minimum spec | Notes |
|---|---|---|
| **CPU** | 2 cores (x86-64) | Intel Core i3 / AMD Ryzen 3 or better. ARM (Raspberry Pi) technically boots Linux but the build/runtime here is x86-64-oriented — don't |
| **RAM** | 4 GB | PostgreSQL (~500 MB) + Next.js app (~300 MB) + nginx (~20 MB) + OS (~500 MB) + build headroom (~1.5 GB) |
| **Storage** | 40 GB SSD | Docker images + app (~1 GB) + DB (~50 MB, growing) + OS/tools (~2 GB) + 7 days backups + headroom |
| **Network** | 100 Mbps | For serving pages to storefront + admin traffic |
| **Power** | Always-on | Server must run 24/7; use a UPS (uninterruptible power supply) to survive outages |

### Recommended (production, comfortable)

| Component | Recommended spec | Notes |
|---|---|---|
| **CPU** | 4 cores | Faster Docker builds, handles 50–100 concurrent users, room for growth |
| **RAM** | 8 GB | Comfortable `docker build` headroom + runtime headroom for traffic spikes |
| **Storage** | 80–120 GB SSD (or NVMe) | SSD is critical — HDD builds are 5–10× slower |
| **Network** | 1 Gbps LAN | Indian fiber connections typically 100 Mbps+ upstream |
| **Power** | UPS with ≥ 30 min battery | Graceful ride-through of the frequent power cuts |

### What the app actually uses (measured, 5.3 stack)

| Resource | Value |
|---|---|
| Build output (Next.js standalone bundle, inside the image) | ~430 MB |
| `node_modules` | ~1.2 GB (inside the image build — never touches the host) |
| Docker images on disk (app incl. node runner, postgres:16-alpine, nginx:alpine) | ~200 MB (keep ≥ 1 GB headroom for rebuild churn) |
| Database (34 models, launch catalog + indexes) | ~50 MB (grows with orders) |
| 7 days of backups (default retention) | a few MB initially, grows with order volume |
| Steady-state RAM (3 containers + OS) | ~1.1 GB |
| Peak RAM during the Docker build | ~1–1.5 GB (inside the builder stage) |

### Hardware don'ts

- ❌ **Don't use a Raspberry Pi or ARM SBC** — the image chain (oven/bun, node:22-slim) targets x86-64 in practice; ARM builds are slow and flaky
- ❌ **Don't use an HDD** — Docker builds and `next build` take 5–10× longer, page loads are sluggish
- ❌ **Don't use < 4 GB RAM** — the Next.js build inside the Docker builder stage will be OOM-killed
- ❌ **Don't host production on a machine you don't control or can't keep powered 24/7** — if that's the constraint, use the [VPS path](./VPS-SETUP-GUIDE.md) instead

### If reusing an old PC/laptop

An old desktop (Intel i5/i7, 8–16 GB RAM, 120 GB SSD) works great. Just make sure:

- It's wired to the network (**Ethernet, not Wi-Fi** — Wi-Fi is unstable for servers)
- It's set to boot after power loss (BIOS setting: **"AC Power Recovery" → "Power On"** — configured properly in Phase J/L)
- **Sleep/hibernate is disabled** in the OS (Phase B does this concretely)
- The fans/cooling are adequate for 24/7 operation; blow the dust out first

---

## 2. Architecture overview

```
                     Internet
                        │
                        ▼
            ┌───────────────────────┐
            │  Router / Firewall    │  ← port forwarding: 80/443 → server LAN IP
            │  (client's network)   │
            └───────────┬───────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Physical Server      │
            │  (static LAN IP)      │
            │                       │
            │  ┌─────────────────┐  │
            │  │ nginx :80/:443  │  │  ← TLS termination (certbot certs),
            │  │ (nginx:alpine)  │  │    the ONLY exposed container
            │  └────────┬────────┘  │
            │           │ app:3000  │
            │           ▼           │
            │  ┌─────────────────┐  │
            │  │      app        │  │  ← Next.js 16 standalone
            │  │ (built image)   │  │    (node:22-slim, non-root)
            │  └────────┬────────┘  │
            │           │ db:5432   │
            │           ▼           │
            │  ┌─────────────────┐  │
            │  │       db        │  │  ← postgres:16-alpine
            │  │  pgdata volume  │  │    (not published on the host)
            │  └─────────────────┘  │
            └───────────────────────┘
```

Same three-container compose stack as the VPS guide (`patelnetworks` project, bridge network `internal`): **nginx** (only service published — 80/443) → **app** (Next.js standalone; entrypoint syncs the schema, then `exec node server.js`) → **db** (postgres:16-alpine on the named `pgdata` volume). Only 80/443 cross the router; 5432 never leaves the compose network.

> **Difference from 5.2:** the older bare-metal guide ran Caddy → pm2/Node → PgBouncer → PostgreSQL. In 5.3 there is **no Caddy** (nginx + certbot instead), **no pm2** (the app is a compose service with `restart: unless-stopped`), and **no PgBouncer** (two containers on one internal network don't need a pooler — a single `DATABASE_URL` with host `db` replaces the old `DATABASE_URL`/`DIRECT_URL` pairing).

---

## Phase A — Install the operating system

### A.1 Download Ubuntu Server LTS

**Recommended: Ubuntu Server 24.04 LTS** (also supported: 22.04 LTS)

Download the ISO: https://ubuntu.com/download/server

> Why Ubuntu **Server** (not Desktop)? No GUI overhead (~500 MB RAM saved), Docker support is excellent, and 90% of tutorials assume it.

### A.2 Create a bootable USB

**On Windows** (use Rufus):

```powershell
# Download Rufus: https://rufus.ie/
# Open Rufus → select the Ubuntu ISO → select your USB drive → Start
```

**On Mac/Linux** (`dd`):

```bash
# Find your USB device
lsblk    # or: diskutil list (Mac)

# Write the ISO (replace /dev/sdX with your USB device — double-check, this wipes it)
sudo dd if=ubuntu-24.04-live-server-amd64.iso of=/dev/sdX bs=4M status=progress
sync
```

### A.3 Boot from the USB

1. Insert the USB into the server
2. Power on → enter BIOS/UEFI (usually `F2`, `F12`, `Del`, or `Esc`)
3. Set boot order: USB first
4. Save + reboot → the Ubuntu installer starts

### A.4 Installer steps

| Step | What to choose |
|---|---|
| Language | English |
| Keyboard | Your layout |
| Installation type | "Ubuntu Server" (minimized — no snap bloat) |
| Network | Configure the static IP here if you already know it (see Phase D — you can also do it later) |
| Storage | "Use an entire disk" → select your SSD → check "Set up this disk as an LVM group" (allows easy resizing later) |
| Profile | Your name + server name (e.g. `patel-prod`) + username (e.g. `deploy`) + a strong password |
| SSH Setup | ✅ Check **"Install OpenSSH server"** — **critical**, this enables remote access for every later phase |
| Snaps | Skip (don't install any snap packages) |

### A.5 Reboot + login

```bash
# After install completes, remove the USB, reboot, and log in at the console:
# username: deploy (or whatever you chose)
# password: the password you set
```

✅ **Checkpoint A**: `ip addr` shows a network interface with an IP address, and `ssh deploy@localhost` works locally.

---

## Phase B — Post-install: updates + deploy user

### B.1 Update the system + install base tools

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ufw fail2ban unattended-upgrades htop
```

(No Node.js/Bun/pm2 here — that's deliberate; Phase E explains why.)

### B.2 Enable automatic security updates

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
# Select "Yes" to automatically install security updates
```

### B.3 Create the deploy user (if you didn't during install)

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
sudo passwd deploy    # set a strong password
```

### B.4 Set the hostname (optional but helpful)

```bash
sudo hostnamectl set-hostname patel-prod
echo "127.0.1.1 patel-prod" | sudo tee -a /etc/hosts
```

### B.5 Disable sleep/hibernate (old-PC reuse)

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

✅ **Checkpoint B**: `sudo apt update` succeeds, the `deploy` user can run `sudo` commands.

---

## Phase C — Remote SSH access setup

From here on you manage the server from your laptop instead of standing in front of it.

### C.1 Find the server's IP address

```bash
# On the server console:
ip addr show
# Look for the "inet" line under your Ethernet interface (e.g. enp3s0)
# Example: inet 192.168.1.50/24 → the LAN IP is 192.168.1.50
```

### C.2 Generate SSH keys on your laptop (if you don't have them)

**On your laptop** (NOT the server):

```bash
# Check if you already have a key:
ls ~/.ssh/id_ed25519.pub 2>/dev/null && echo "You already have a key" || echo "Need to generate one"

# Generate a new key (if needed):
ssh-keygen -t ed25519 -C "your_email@example.com"
# Press Enter for the defaults (empty passphrase is convenient; a passphrase is more secure)
```

### C.3 Copy your public key to the server

```bash
# On your laptop (replace 192.168.1.50 with the server's IP):
ssh-copy-id deploy@192.168.1.50
# Enter the deploy user's password when prompted
```

### C.4 Test passwordless login

```bash
ssh deploy@192.168.1.50
# You should now log in WITHOUT a password (using the key)
```

✅ **Checkpoint C**: `ssh deploy@<server-ip>` logs you in without asking for a password.

### C.5 Disable password authentication

Once key-based login works, harden SSH:

```bash
# On the server:
sudo nano /etc/ssh/sshd_config
```

Find and change:

```
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
```

Save and restart SSH:

```bash
sudo systemctl restart ssh
```

> ⚠️ **Keep your current SSH session open** and open a NEW terminal to test that passwordless login still works. Only close the original session after confirming. If it breaks, the console fix is in [Troubleshooting](#troubleshooting).

### C.6 (Optional) SSH config alias

**On your laptop**, edit `~/.ssh/config`:

```
Host patel-prod
    HostName 192.168.1.50
    User deploy
    IdentityFile ~/.ssh/id_ed25519
```

Now `ssh patel-prod` is enough.

---

## Phase D — Network configuration (static IP + firewall + port forwarding)

### D.1 Static LAN IP (so the server's address never changes)

#### Option 1 — Router-side (recommended, easiest)

Reserve a static IP for the server's MAC address in your router's DHCP settings. Look for "DHCP Reservation" / "Static Lease" in the router admin panel (usually `http://192.168.1.1`), e.g. always assign `192.168.1.50` to this machine.

#### Option 2 — Server-side (Netplan)

```bash
# Find your interface name:
ip link show          # e.g. enp3s0

# Find your router's IP (gateway):
ip route | grep default    # e.g. default via 192.168.1.1

# Edit the netplan config:
sudo nano /etc/netplan/00-installer-config.yaml
```

Replace with (adjust IPs + interface name to your network):

```yaml
network:
  version: 2
  ethernets:
    enp3s0:
      addresses:
        - 192.168.1.50/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
```

Apply + test:

```bash
sudo netplan apply
ping -c 3 google.com
```

### D.2 Host firewall (UFW)

```bash
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP (ACME challenge + redirect)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable           # type "y"
sudo ufw status verbose
```

> ⚠️ **PostgreSQL (5432) is NOT published by docker-compose at all** — the `db` service has no `ports:` entry, so nothing on the host listens on 5432. Never add it to UFW, and **never create a router port-forward for it**. Verify with `sudo ss -tlnp | grep -E ':3000|:5432'` → prints nothing (once the stack is up, the containers talk over the internal Docker network only).

### D.3 Router port forwarding

To make the site reachable from the internet, forward ports 80 + 443 from the router to the server's LAN IP:

1. Open the router admin panel (usually `http://192.168.1.1`)
2. Find "Port Forwarding" / "Virtual Server" / "NAT"
3. Add rules:
   - External port **80** → Internal IP `192.168.1.50` → Internal port **80** (TCP)
   - External port **443** → Internal IP `192.168.1.50` → Internal port **443** (TCP)
4. Save + apply

### D.4 Dynamic DNS (if the ISP doesn't provide a static public IP)

Indian consumer connections are usually dynamic. Use a free DDNS service so TLS and DNS survive IP changes:

- **DuckDNS** (https://www.duckdns.org/) — free, simplest
- **No-IP** (https://www.noip.com/) — free tier

Set up DuckDNS (their install page gives a one-line cron that updates your record, e.g. `patelnetworks.duckdns.org`, whenever the public IP changes), then use that hostname everywhere below instead of `patelnetworks.in`.

✅ **Checkpoint D**: with a temporary listener on the server — `sudo timeout 120 python3 -m http.server 80` — a request **from outside the network** (phone on mobile data: `curl -I http://<public-ip-or-ddns-host>/`) connects. Once the stack is deployed (Phase F), the same test returns the storefront, or a 502 if nginx is up but the app is down — either proves the router path works.

---

## Phase E — Install Docker

```bash
# Docker Engine + compose plugin, from the official repo:
curl -fsSL https://get.docker.com | sudo sh

# Add the deploy user to the docker group (no sudo needed for every command)
sudo usermod -aG docker "$USER"
newgrp docker   # apply immediately (or re-login)

# Verify
docker --version          # Docker 24+
docker compose version    # Compose v2
docker run hello-world    # success message
```

> **Deliberate difference from 5.2 (Phase F there):** the old bare-metal guide installed Node.js 20 + Bun + pm2 on the host next. **5.3 installs none of that** — Bun performs the dependency install and `next build` inside the image's builder stage, Node 22 runs the app inside the runner image, and `restart: unless-stopped` in `docker-compose.yml` handles process supervision and boot ordering. The host runs Ubuntu, Docker, and nothing else. Enable Docker at boot (it is by default): `sudo systemctl is-enabled docker` → `enabled`.

✅ **Checkpoint E**: `docker run hello-world` prints "Hello from Docker!".

---

## Phase F — Deploy the application stack

### F.1 Get the code

```bash
sudo mkdir -p /opt/patelnetworks && sudo chown "$USER" /opt/patelnetworks
git clone https://github.com/OmKardile/patel-5.3.git /opt/patelnetworks
cd /opt/patelnetworks
```

**On-disk persistence note:** the database lives in the compose named volume `pgdata` (physically under `/var/lib/docker/volumes/patelnetworks_pgdata/_data`). It survives reboots, power cuts, and app rebuilds — the SSD it sits on is the same disk as the OS, which is exactly what you want on bare metal. If the client insists on owning the data directory on-host, switch the `db` service to a bind mount instead:

```yaml
  db:
    volumes:
      - /var/lib/patelnetworks/pgdata:/var/lib/postgresql/data
```

```bash
sudo mkdir -p /var/lib/patelnetworks/pgdata
# postgres:16-alpine runs as uid 70 (the alpine postgres user — Debian-based
# postgres images use 999; if you ever switch the image, re-chown accordingly):
sudo chown -R 70:70 /var/lib/patelnetworks/pgdata && sudo chmod 700 /var/lib/patelnetworks/pgdata
```

The default named volume is fine — this is optional.

### F.2 Create the `.env` file

```bash
cp .env.example .env
nano .env
```

Generate the secrets:

```bash
openssl rand -hex 16        # → POSTGRES_PASSWORD
openssl rand -hex 32        # → JWT_SECRET
openssl rand -base64 18     # → ADMIN_PASSWORD
```

Fill the essentials (full walkthrough: [`deploy/ENV-SETUP.md`](../deploy/ENV-SETUP.md)):

```bash
# --- database — host MUST be `db`, the compose service name ---
DATABASE_URL="postgresql://patel:<POSTGRES_PASSWORD>@db:5432/patelnetworks?schema=public"
POSTGRES_USER=patel
POSTGRES_PASSWORD=<the hex value>
POSTGRES_DB=patelnetworks

# --- sessions + OTP hashing (REQUIRED) ---
JWT_SECRET=<the 32-byte hex value>

# --- first admin bootstrap (first /admin/login submit creates the SUPER_ADMIN) ---
ADMIN_EMAIL=admin@patelnetworks.in
ADMIN_PASSWORD=<the base64 value>

# --- public origin — SET BEFORE THE FIRST BUILD (see F.3) ---
NEXT_PUBLIC_APP_URL=https://patelnetworks.in   # or https://<your-duckdns-host>.duckdns.org

# --- schema-sync gate ---
RUN_MIGRATIONS=true

# Razorpay / Shiprocket / SMS / WhatsApp: leave UNSET → deterministic simulation
# (order_sim_* payments, DELH<10hex> AWBs, [SIMULATED SMS] in `docker compose logs app`).
```

> ⚠️ `DATABASE_URL` host must be **`db`** — `localhost` inside the app container cannot reach Postgres; this is the #1 cause of `{"status":"degraded"}`. The URL password must match `POSTGRES_PASSWORD` exactly.

### F.3 Build-time origin + build + start

Uncomment the build `args:` block in `docker-compose.yml` and set your origin (it's inlined into client bundles at build time):

```yaml
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_APP_URL: https://patelnetworks.in
```

Then build + start (first build ~5–15 min; on a 4 GB box add swap first — see [Troubleshooting](#troubleshooting)):

```bash
docker compose up -d --build
docker compose ps                 # app + db → healthy; nginx → Up
docker compose logs -f app        # watch the entrypoint
```

Expected app log:

```
[entrypoint] Patel Networks app starting (NODE_ENV=production PORT=3000)
[entrypoint] RUN_MIGRATIONS=true -> syncing database schema
[entrypoint] no prisma/migrations dir -> prisma db push --skip-generate
[entrypoint] schema sync done
[entrypoint] exec node server.js
```

### F.4 Load the data — seed (fresh) or restore (existing)

**Fresh box — seed the launch catalog:**

```bash
docker build --target builder -t patel-builder .
docker run --rm --network patelnetworks_internal --env-file .env \
  -v "$PWD/prisma:/app/prisma" patel-builder bun prisma/seed.ts
```

- `prisma/seed-images.json` is committed and the imagery ships in the image — the seed runs clean.
- Seed default admin: `superadmin@patelnetworks.in` / `patel@admin2026` — **if `ADMIN_EMAIL`/`ADMIN_PASSWORD` are set they override it** (they are, per F.2 — never leave the seed default live on a public host).

**Migrating an existing production box — restore the newest `deploy/backup.sh` archive** (a plain-SQL `pg_dump` with `--clean --if-exists`):

```bash
scp old-box:/opt/patelnetworks/backups/patelnetworks_<ts>.sql.gz /tmp/
gunzip -c /tmp/patelnetworks_<ts>.sql.gz | docker compose exec -T db psql -U patel -d patelnetworks
```

✅ **Checkpoint F**: `docker compose ps` shows app + db healthy and nginx Up; the app log shows `schema sync done` then `exec node server.js`; seed or restore completed without errors.

---

## Phase G — Verify the app + first admin bootstrap

```bash
curl -fsS http://127.0.0.1/api/health
# → {"status":"healthy","db":"up","time":"..."}   ({"status":"degraded"} → Troubleshooting)

curl -fsS http://127.0.0.1/ | grep -o '<title>[^<]*</title>'
# → the Patel Networks storefront <title>

for r in / /products /kit-builder /admin/login; do
  printf "%-14s %s\n" "$r" "$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1$r)"
done   # all 200
```

**First admin:** open `http://<LAN-IP-or-ddns-host>/admin/login` (HTTPS arrives in Phase H) and submit `ADMIN_EMAIL`/`ADMIN_PASSWORD` once — the first submit bootstraps that account as **SUPER_ADMIN**. Log in, then change the password immediately (and confirm the seed default is not what you're using).

✅ **Checkpoint G**: health JSON `healthy`/`db: up`, homepage title renders, all four smoke routes 200, admin login works.

---

## Phase H — TLS via certbot

Identical to the VPS guide's [Phase F](./VPS-SETUP-GUIDE.md#phase-f--tls-via-certbot) — repeated here so this guide stands alone on-site.

### H.1 Install certbot + issue the certificate

```bash
sudo apt-get install -y certbot

# 1) Free port 80 (standalone mode must bind it):
sudo systemctl stop nginx 2>/dev/null; docker compose stop nginx

# 2) Issue the cert — DNS must already point here (DuckDNS host works fine):
sudo certbot certonly --standalone -d patelnetworks.in -d www.patelnetworks.in

# 3) Copy live + archive into the mounted certs folder (-L dereferences symlinks):
sudo cp -rL /etc/letsencrypt/live /opt/patelnetworks/nginx/certs/
sudo cp -rL /etc/letsencrypt/archive /opt/patelnetworks/nginx/certs/
```

### H.2 Enable the HTTPS server block

Edit `nginx/conf.d/patel.conf`:

1. **Uncomment the entire `server { listen 443 ssl; … }` block** at the bottom.
2. Set `server_name` to your domain/DuckDNS host.
3. Point the cert paths at the certs folder (the template's `/etc/letsencrypt/...` paths assume the alternative letsencrypt-mount setup):
   ```nginx
   ssl_certificate     /etc/nginx/certs/live/patelnetworks.in/fullchain.pem;
   ssl_certificate_key /etc/nginx/certs/live/patelnetworks.in/privkey.pem;
   ```
4. Optionally convert the `:80` block into an HTTPS redirect.

### H.3 Restart nginx + verify

```bash
docker compose up -d nginx
curl -fsSI https://patelnetworks.in        # HTTP/2 200, valid cert
```

✅ **Checkpoint H**: padlock in the browser; `curl -fsSI https://…` returns 200 over TLS.

### H.4 Renewals (90-day certs)

```bash
sudo certbot renew --dry-run
```

Root crontab (note `;` separators — nginx must always come back, even if renewal fails):

```cron
17 3 * * 1 cd /opt/patelnetworks && docker compose stop nginx; certbot renew --quiet; cp -rL /etc/letsencrypt/live nginx/certs/; cp -rL /etc/letsencrypt/archive nginx/certs/; docker compose up -d nginx >> /var/log/patel-tls.log 2>&1
```

Zero-downtime alternative: the webroot variant documented at the bottom of `nginx/conf.d/patel.conf` (uncomment the ACME location + the certbot volumes, renew with `--webroot`, then just re-copy + `docker compose exec nginx nginx -s reload`).

---

## Phase I — Automated backups

### I.1 Test the backup script

```bash
cd /opt/patelnetworks
./deploy/backup.sh
ls -lh backups/    # → patelnetworks_<timestamp>.sql.gz
```

`deploy/backup.sh` dumps the DB via `pg_dump` inside the `db` container into `./backups/<db>_<timestamp>.sql.gz` and prunes archives older than **7 days**.

### I.2 Daily cron

```bash
sudo crontab -e
```

```cron
30 2 * * * cd /opt/patelnetworks && ./deploy/backup.sh >> ./backups/backup.log 2>&1
```

### I.3 Offsite copy

A disk failure that takes the server also takes local backups. Ship them off the machine daily:

```cron
45 2 * * * rsync -a /opt/patelnetworks/backups/ backup-user@other-machine:/backups/patelnetworks/
```

On bare metal a cheap option is a **USB drive** left plugged in (mount it, e.g. `/mnt/usb-backup`, and rsync there) — but a copy on a *different* machine or cloud storage (rclone) is safer, since theft/fire takes both disks at once. Quarterly, run one restore drill:

```bash
gunzip -c backups/<file>.sql.gz | docker compose exec -T db psql -U patel -d patelnetworks
```

✅ **Checkpoint I**: fresh `.sql.gz` in `./backups/`, cron installed, offsite/USB target configured.

---

## Phase J — Security hardening

### J.1 fail2ban (installed in Phase B)

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd    # jail should be active
```

### J.2 Firewall check

```bash
sudo ufw status verbose    # 22/80/443 only; 5432 is not published by compose at all
```

### J.3 SSH (already done in Phase C)

Confirm: `PasswordAuthentication no`, `PermitRootLogin no`, key-only login verified from a second terminal.

### J.4 Unattended upgrades (installed in Phase B)

```bash
cat /etc/apt/apt.conf.d/20auto-upgrades
# APT::Periodic::Update-Package-Lists "1";
# APT::Periodic::Unattended-Upgrade "1";
```

### J.5 BIOS settings (physical-server specific)

Enter BIOS and configure:

- **AC Power Recovery → "Power On"** — the server boots itself after a power cut (this is the single most important BIOS setting for Indian power conditions; see Phase L)
- **Disable USB boot** — prevents physical-access attacks via USB; re-enable temporarily only when you need to boot an installer
- **Set a BIOS admin password** — prevents BIOS tampering (and stops someone casually re-enabling USB boot)

✅ **Checkpoint J**: `fail2ban-client status sshd` active, UFW shows 22/80/443 only, key-only SSH works, BIOS hardened.

---

## Phase K — Monitoring basics

```bash
htop                       # CPU + RAM per process (install: sudo apt install htop)
df -h                      # disk usage — watch /var/lib/docker and backups/
docker compose ps          # container health at a glance
docker compose logs -f app # live app logs (also shows [SIMULATED SMS] OTPs in sim mode)
curl -fsS http://127.0.0.1/api/health   # {"status":"healthy","db":"up",...}
```

Useful one-offs:

```bash
docker stats --no-stream   # per-container CPU/RAM snapshot
docker system df           # how much disk Docker itself is using
```

**External uptime monitor (recommended):** UptimeRobot (https://uptimerobot.com/, free) — add an HTTP monitor for `https://patelnetworks.in/api/health` (5-min checks) so the owner gets pinged if the site or DB goes down from the outside. Internal `htop` won't tell you the broadband line died; an external monitor will.

✅ **Checkpoint K**: you know the four commands that answer "is it alive, and why not", and an external monitor is configured.

---

## Phase L — Power-cut resilience & boot order

The stack is designed to come back on its own after an outage:

1. **BIOS**: AC Power Recovery → *Power On* (Phase J.5) — power returns → machine boots → Ubuntu boots.
2. **Docker daemon**: `systemctl is-enabled docker` → `enabled` — the daemon starts at boot.
3. **Containers**: `restart: unless-stopped` on all three services — Docker restarts them automatically in dependency order.

**Belt-and-braces** (recommended for dirty power / docker-daemon start races): a one-line `@reboot` cron that re-asserts the stack 30 seconds after boot. Add to `/etc/crontab`:

```
@reboot root sleep 30 && cd /opt/patelnetworks && docker compose up -d >> /var/log/patel-boot.log 2>&1
```

(With `restart: unless-stopped` this is normally redundant — that's fine; it's insurance for the cases where the daemon came up but containers didn't.)

**UPS sizing**: ≥ 30 min battery (recommended spec) lets the owner ride out short cuts entirely. If you add a USB UPS, `nut` or `apcupsd` can shut the machine down gracefully at low battery — optional, beyond this guide's scope.

After the next real power cut, verify: `docker compose ps` (all three up) + `curl -fsS http://127.0.0.1/api/health`.

✅ **Checkpoint L**: BIOS AC recovery is Power On, the `@reboot` line is installed, and a deliberate power-pull test brought everything back on its own.

---

## Phase M — Final validation & cutover

### M.1 Full sweep

```bash
cd /opt/patelnetworks
curl -fsS https://patelnetworks.in/api/health            # healthy / db: up
curl -fsS https://patelnetworks.in/ | grep -o '<title>[^<]*</title>'
for r in / /products /kit-builder /admin/login; do
  printf "%-14s %s\n" "$r" "$(curl -fsS -o /dev/null -w '%{http_code}' https://patelnetworks.in$r)"
done                                                      # all 200
docker compose ps                                         # app+db healthy, nginx Up
sudo ufw status                                           # 22/80/443 only
df -h /                                                   # headroom on /
docker system df                                          # Docker disk usage
./deploy/backup.sh                                        # one fresh archive
```

Typecheck/lint (`bun run typecheck`, `bun run lint`) run on the dev machine/CI — the server host has no Node/Bun toolchain by design.

### M.2 Cutover

Point the client at the new host (DNS if migrating from a VPS, or just the new DDNS/domain), keep the **old machine untouched for 24 hours** as the fallback, and take one `deploy/backup.sh` archive from the old box on cutover day so both hosts hold the same data. **Recommendation: run the new server for at least 24 hours (one full order/dispatch cycle + one nightly backup) before relying on it.**

✅ **Checkpoint M (final)**: everything above passes over HTTPS, backups run, monitoring pings, and the machine has survived a soak test.

---

## Troubleshooting

### Locked out via SSH (after disabling password auth)

- Plug a keyboard + monitor into the server (you kept physical access for exactly this)
- Log in at the console as `deploy`
- `sudo nano /etc/ssh/sshd_config` → set `PasswordAuthentication yes` temporarily
- `sudo systemctl restart ssh`
- Fix your key setup, then re-disable password auth

### Site loads slowly

```bash
htop      # RAM pegged > 90%? add swap:
          #   sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile \
          #   && sudo mkswap /swapfile && sudo swapon /swapfile
          #   + echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
df -h     # disk > 90%? prune old Docker images + check backups/ retention
```

### Server doesn't boot the app after a power cut

- BIOS → AC Power Recovery must be **Power On** (Phase J.5)
- Check the `@reboot` line from Phase L is in `/etc/crontab`
- `docker compose ps` + `/var/log/patel-boot.log` tell you how far boot got

### Public IP changed (dynamic ISP)

- With DuckDNS (or No-IP) the record updates itself — verify at the DDNS dashboard
- Without DDNS: update the DNS A record manually; the server doesn't care (nginx binds `0.0.0.0`)

### `/api/health` → `{"status":"degraded"}`

`docker compose logs db` — almost always `POSTGRES_PASSWORD` vs the password inside `DATABASE_URL` mismatch, or the URL host isn't `db`. Fix `.env`, `docker compose up -d` so both containers re-read it.

### 502 from nginx

App crashed: `docker compose ps` + `docker compose logs app --tail 50`.

### `docker compose` command not found

Old Docker — use `docker-compose` (hyphen) as a fallback, or upgrade: `curl -fsSL https://get.docker.com | sudo sh`.

### Build OOM-killed (4 GB box)

Add 4 GB swap (commands above), or build the image elsewhere and load it:

```bash
# on a dev machine:  docker build -t patelnetworks-app:latest . \
#                      --build-arg NEXT_PUBLIC_APP_URL=https://patelnetworks.in
docker save patelnetworks-app:latest | gzip > app.tar.gz
# copy to the server, then:
docker load < app.tar.gz && docker compose up -d --no-build
```

### Admin login "Invalid credentials" on a fresh box

`ADMIN_EMAIL`/`ADMIN_PASSWORD` unset (bootstrap never fires) or that email already exists — see `deploy/ENV-SETUP.md` §6.

---

## Rollback procedure

1. **App image (fastest):** before each update you tagged the known-good image (`docker tag patelnetworks-app:latest patelnetworks-app:prev`):
   ```bash
   docker tag patelnetworks-app:prev patelnetworks-app:latest
   docker compose up -d --force-recreate --no-build app
   ```
2. **Source rollback:** `git checkout <previous-tag-or-sha> && docker compose up -d --build`.
3. **Database rollback:** restore the newest pre-update archive:
   ```bash
   gunzip -c backups/patelnetworks_<ts>.sql.gz | docker compose exec -T db psql -U patel -d patelnetworks
   ```
   Then re-deploy the matching app version so code and schema agree.
4. Old images are retained until pruned — `docker images` lists them.

---

## Quick reference — the 12 commands

```bash
# 1. Base tools + updates
sudo apt update && sudo apt upgrade -y && sudo apt install -y curl wget git ufw fail2ban unattended-upgrades htop

# 2. Install Docker (the ONLY runtime the host needs — no Node/Bun/pm2 in 5.3)
curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker "$USER" && newgrp docker

# 3. Firewall
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable

# 4. Code + env (host MUST be `db` in DATABASE_URL)
sudo mkdir -p /opt/patelnetworks && sudo chown "$USER" /opt/patelnetworks \
  && git clone https://github.com/OmKardile/patel-5.3.git /opt/patelnetworks \
  && cd /opt/patelnetworks && cp .env.example .env && nano .env

# 5. Build + start the 3-container stack
docker compose up -d --build && docker compose ps && docker compose logs -f app

# 6. Health + smoke
curl -fsS http://127.0.0.1/api/health
for r in / /products /kit-builder /admin/login; do curl -fsS -o /dev/null -w "%{http_code} $r\n" http://127.0.0.1$r; done

# 7. Seed the launch catalog (fresh box) — builder image carries bun + deps
docker build --target builder -t patel-builder . && docker run --rm --network patelnetworks_internal \
  --env-file .env -v "$PWD/prisma:/app/prisma" patel-builder bun prisma/seed.ts

# 8. …or restore existing data from a backup archive
gunzip -c backups/patelnetworks_<ts>.sql.gz | docker compose exec -T db psql -U patel -d patelnetworks

# 9. TLS (first issue; renewals via the Phase H.4 cron)
docker compose stop nginx && sudo certbot certonly --standalone -d patelnetworks.in -d www.patelnetworks.in \
  && sudo cp -rL /etc/letsencrypt/live nginx/certs/ && sudo cp -rL /etc/letsencrypt/archive nginx/certs/ \
  && docker compose up -d nginx

# 10. Backups + daily cron
./deploy/backup.sh
echo "30 2 * * * cd /opt/patelnetworks && ./deploy/backup.sh >> ./backups/backup.log 2>&1" | sudo crontab -

# 11. Power-cut insurance (@reboot, in /etc/crontab)
echo "@reboot root sleep 30 && cd /opt/patelnetworks && docker compose up -d >> /var/log/patel-boot.log 2>&1" | sudo tee -a /etc/crontab

# 12. Update (tag first!) + rollback
./deploy/backup.sh && docker tag patelnetworks-app:latest patelnetworks-app:prev \
  && git pull && docker compose up -d --build
# rollback: docker tag patelnetworks-app:prev patelnetworks-app:latest && docker compose up -d --force-recreate --no-build app
```

---

## What you need before starting

1. **The server hardware** (see §1 — minimum 2 cores / 4 GB RAM / 40 GB SSD, x86-64)
2. **A USB drive** (≥ 4 GB) to install the OS
3. **Physical access** to the server for Phase A only — after that everything is remote via SSH (keep console access possible for the SSH-lockout rescue)
4. **Chosen passwords** (generate with the `openssl` commands in Phase F):
   - `POSTGRES_PASSWORD` (DB credentials — `openssl rand -hex 16`)
   - `JWT_SECRET` (sessions + OTP hashing — `openssl rand -hex 32`)
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` (first SUPER_ADMIN bootstrap — `openssl rand -base64 18`)
5. **Router admin access** (DHCP reservation + port forwarding in Phase D)
6. **A domain name or DuckDNS/No-IP host** (optional but recommended — needed for HTTPS)
7. **A UPS** (recommended ≥ 30 min — power cuts are the bare-metal failure mode)
8. **The newest `deploy/backup.sh` archive** — only if migrating an existing production box (Phase F.4)

That's it. Everything else is in this guide.

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
| **Ubuntu Server 24.04 LTS** | The OS | https://ubuntu.com/server/docs |
| **UFW (Uncomplicated Firewall)** | Host firewall | https://help.ubuntu.com/community/UFW |
| **fail2ban** | SSH brute-force protection | https://github.com/fail2ban/fail2ban/wiki |
| **pg_dump** | Database backup (`deploy/backup.sh`) | https://www.postgresql.org/docs/16/app-pgdump.html |
| **psql** | Restore / ad-hoc queries | https://www.postgresql.org/docs/16/app-psql.html |

### OS installation & remote access

| Tool | What it does | Official docs |
|---|---|---|
| **Rufus** (Windows) | Create bootable USB | https://rufus.ie/ |
| **dd** (Linux/Mac) | Write ISO to USB | `man dd` or https://www.gnu.org/software/coreutils/manual/html_node/dd-invocation.html |
| **Ubuntu Server ISO download** | OS installer image | https://ubuntu.com/download/server |
| **Netplan** (static IP config) | Ubuntu network config | https://netplan.readthedocs.io/ |
| **OpenSSH** | SSH server + client | https://www.openssh.com/manual.html |
| **ssh-keygen** | Generate SSH keys | https://www.ssh.com/academy/ssh/keygen |
| **ssh-copy-id** | Copy public key to server | https://www.ssh.com/academy/ssh/copy-id |

### DNS & HTTPS

| Service | Official link |
|---|---|
| Let's Encrypt | https://letsencrypt.org/getting-started/ |
| DuckDNS (dynamic DNS) | https://www.duckdns.org/ |
| No-IP (dynamic DNS) | https://www.noip.com/ |
| Cloudflare (DNS + CDN, optional) | https://developers.cloudflare.com/ |

### Security

| Resource | Link |
|---|---|
| unattended-upgrades (automatic security updates) | https://wiki.debian.org/UnattendedUpgrades |
| GitHub Personal Access Tokens (for `git pull` on the server) | https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens |
| BFG Repo-Cleaner (purge secrets from git history) | https://rtyley.github.io/bfg-repo-cleaner/ |

---

<p align="center"><em>Patel Networks / MegaTechzy</em><br/><sub>Surveillance hardware procurement platform · India</sub></p>
