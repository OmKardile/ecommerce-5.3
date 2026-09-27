#!/bin/sh
# =============================================================================
# with-env.sh — run a command with .env taking precedence over inherited env.
#
# WHY THIS EXISTS (D-13 / Task 28): two hosts, two precedence problems.
#   - Sandbox: the session injects a STALE `DATABASE_URL=file:…/custom.db`
#     into the process environment, and OS env beats `.env` files — so
#     `next dev` / `prisma` would silently talk to the wrong DB.
#   - Render: there IS no .env; DATABASE_URL comes from the dashboard env.
#     A previous fix (`env -u DATABASE_URL …`) stripped it there and broke
#     the build ("Environment variable not found: DATABASE_URL", P1012).
#
# RULE: if .env exists → source it with `set -a` so its values OVERRIDE the
# inherited environment; if not → pass the inherited environment through
# untouched. Correct in both worlds, for every variable, not just DATABASE_URL.
#
# Usage (from package.json scripts, where node_modules/.bin is on PATH):
#   sh scripts/with-env.sh <command> [args...]
# =============================================================================
set -e

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

exec "$@"
