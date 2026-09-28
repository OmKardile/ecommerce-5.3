#!/bin/sh
# =============================================================================
# Patel Networks / MegaTechzy — container entrypoint
#
# Responsibilities:
#   1. MIGRATION GATE (RUN_MIGRATIONS=true, see .env.example):
#        - if prisma/migrations/ exists in the image -> `prisma migrate deploy`
#        - otherwise (current repo strategy)          -> `prisma db push --skip-generate`
#   2. Hand off to the Next.js standalone server (exec node server.js).
#
# MIGRATION STRATEGY NOTE (worklog Task 1 / Task 3-b):
#   The sandbox develops against SQLite with `prisma db push` and the repo has
#   NO prisma/migrations folder. On the VPS the image ships the same schema
#   with provider switched to postgresql (Dockerfile, in-image sed), so `db
#   push` syncs PostgreSQL on every boot: safe on a fresh volume and for
#   additive changes; it intentionally runs WITHOUT --accept-data-loss so any
#   destructive drift aborts loudly instead of silently dropping columns.
#   If the team adopts versioned migrations later: run `bun run db:migrate`
#   in dev, COMMIT prisma/migrations/, rebuild — this script automatically
#   switches to `migrate deploy` (incremental, order-preserving, never resets).
#
# The Prisma CLI + engines are baked into the image (copied from the builder
# stage) so migrations never depend on npx/network at boot.
# =============================================================================
set -e

PRISMA_CLI="node node_modules/prisma/build/index.js"

echo "[entrypoint] Patel Networks app starting (NODE_ENV=${NODE_ENV:-unset} PORT=${PORT:-3000})"

if [ "${RUN_MIGRATIONS}" = "true" ]; then
    echo "[entrypoint] RUN_MIGRATIONS=true -> syncing database schema"

    if [ ! -f "./prisma/schema.prisma" ]; then
        echo "[entrypoint] FATAL: prisma/schema.prisma missing from image" >&2
        exit 1
    fi
    if [ ! -f "./node_modules/prisma/build/index.js" ]; then
        echo "[entrypoint] FATAL: Prisma CLI missing from image (RUN_MIGRATIONS=true requires it)" >&2
        exit 1
    fi

    if [ -d "./prisma/migrations" ]; then
        echo "[entrypoint] prisma/migrations found -> prisma migrate deploy"
        $PRISMA_CLI migrate deploy
    else
        echo "[entrypoint] no prisma/migrations dir -> prisma db push --skip-generate"
        $PRISMA_CLI db push --skip-generate
    fi

    echo "[entrypoint] schema sync done"
else
    echo "[entrypoint] RUN_MIGRATIONS!=true -> skipping schema sync"
fi

echo "[entrypoint] exec node server.js"
exec node server.js
