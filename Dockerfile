# =============================================================================
# Patel Networks / MegaTech — production image (client Ubuntu VPS, x86_64)
# Multi-stage: deps (bun install) -> builder (prisma generate + next build)
#            -> runner (node:22-slim, non-root, Next.js standalone output)
#
# DECISIONS (full rationale in worklog.md Task 3-b + deploy/DEPLOY-STEPS.md):
# 1. STANDALONE: next.config.ts already sets output:"standalone", and the
#    project's package.json build script assembles the bundle:
#      next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
#    => the runner needs exactly ONE copy of .next/standalone (static + public
#    already live inside it). If that script is ever simplified, revert to the
#    canonical three-copy recipe (standalone + .next/static + public).
# 2. RUNNER BASE = node:22-slim (Debian), NOT alpine: the builder (oven/bun:1)
#    is Debian bookworm, so Prisma engines are generated for
#    linux-debian-openssl-3.0.x. A musl/alpine runner would crash at startup
#    unless schema.prisma adds binaryTargets = ["linux-musl-openssl-3.0.x"].
#    Debian -> Debian keeps every engine platform consistent.
# 3. PROVIDER SWITCH: repo schema.prisma is provider="sqlite" (sandbox
#    constraint, 100%-portable schema per worklog Task 0/1). The switch to
#    "postgresql" happens INSIDE the image via sed below — the repo file is
#    never modified. Override with --build-arg PRISMA_PROVIDER=... if ever
#    needed. Portable schema guarantees: no Prisma enums, no native arrays,
#    money = integer paise.
# 4. SECRETS: nothing secret is required at build time. The session secret
#    (code reads JWT_SECRET — the deployment spec calls it AUTH_SECRET),
#    Razorpay, Shiprocket, SMS/WhatsApp credentials are injected at RUNTIME
#    via env_file: .env in docker-compose.yml. Placeholder credentials activate
#    deterministic simulation mode (payments sandbox dialog, [SIMULATED SMS],
#    simulated shipping) — see .env.example.
# 5. MIGRATIONS at container start are gated by RUN_MIGRATIONS=true and run in
#    docker-entrypoint.sh (db push today; migrate deploy auto-activates the
#    moment a prisma/migrations/ folder is committed). Prisma CLI + engines are
#    copied from the builder so this works offline (no npx fetch at boot).
# =============================================================================

# ---------------------------------------------------------------- deps ------
FROM oven/bun:1 AS deps
WORKDIR /app
# prisma/ is copied BEFORE install so that @prisma/client's postinstall (if
# executed under bun's trusted-dependency rules) can find the schema instead of
# erroring. The builder re-runs `prisma generate` after the provider switch.
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# ------------------------------------------------------------- builder ------
FROM oven/bun:1 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_APP_URL is the only build-time var that matters: Next.js inlines
# NEXT_PUBLIC_* into client bundles (metadataBase, sitemap, robots).
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ARG PRISMA_PROVIDER=postgresql

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Single-line provider switch — in-image only, repo file untouched (decision 3).
RUN sed -i "s/provider = \"sqlite\"/provider = \"${PRISMA_PROVIDER}\"/" prisma/schema.prisma \
 && grep -q "provider = \"${PRISMA_PROVIDER}\"" prisma/schema.prisma \
 && bunx prisma generate

RUN bun run build

# -------------------------------------------------------------- runner ------
FROM node:22-slim AS runner
WORKDIR /app
# HOSTNAME must be pinned: Next standalone reads HOSTNAME at boot, and Docker
# sets it to the container id by default, which would break 0.0.0.0 binding.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# openssl: Prisma engines need libssl present on Debian slim. ca-certificates:
# outbound TLS (Razorpay / Shiprocket / Fast2SMS / WhatsApp Cloud API).
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs --home /app nextjs

# Standalone server (static + public included inside — decision 1).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Writable cache dir for the Next.js image optimizer / incremental cache
# (non-root user must own it or runtime cache writes fail loudly).
RUN mkdir -p /app/.next/cache \
 && chown -R nextjs:nodejs /app/.next/cache \
 && chown nextjs:nodejs /app

# Prisma schema (already postgres provider) + CLI + engines for the
# entrypoint's migration gate (offline `db push` / `migrate deploy`).
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/engines ./node_modules/@prisma/engines

# Entrypoint: replaces the base node image's /usr/local/bin/docker-entrypoint.sh
# at the same path (intentional — we exec `node server.js` ourselves).
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# /api/health pings the DB (SELECT 1) but always answers 200 — this checks the
# app is up and serving; DB liveness is additionally covered by the db service
# healthcheck in docker-compose.yml.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
