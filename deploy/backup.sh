#!/usr/bin/env bash
# =============================================================================
# Patel Networks / MegaTechzy — PostgreSQL backup script (run on the VPS)
#
# Usage:
#   chmod +x deploy/backup.sh        # (already set in the repo)
#   ./deploy/backup.sh               # or from any cwd: (cd repo && ./deploy/backup.sh)
#
# What it does:
#   1. Locates the compose stack (docker compose, falls back to docker-compose).
#   2. Reads POSTGRES_USER / POSTGRES_DB from .env (password never handled here —
#      `pg_dump` authenticates INSIDE the db container as the superuser env).
#   3. Streams a custom-format dump through gzip into ./backups/<db>_<ts>.sql.gz
#   4. Retention: keeps the last 7 DAILY backups (deletes files older than 7
#      days in ./backups) — see RETENTION_DAYS below.
#
# Scheduling (daily 02:30 IST approx — cron uses server TZ):
#   30 2 * * *  cd /opt/patelnetworks && ./deploy/backup.sh >> ./backups/backup.log 2>&1
#   (adjust the path to wherever the repo is cloned — see DEPLOY-STEPS.md step 9)
#
# Restore drill (do one quarterly, per production-deployment-checklist):
#   gunzip -c backups/<file>.sql.gz | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
# =============================================================================
set -euo pipefail

# ------- configuration -------------------------------------------------------
COMPOSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # repo root
BACKUP_DIR="${COMPOSE_DIR}/backups"
RETENTION_DAYS=7          # 7 daily backups; older files are pruned
# -----------------------------------------------------------------------------

cd "${COMPOSE_DIR}"

# --- locate compose ----------------------------------------------------------
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERROR: docker compose not found" >&2
  exit 1
fi

# --- ensure the db service is running ---------------------------------------
if ! "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx 'db'; then
  echo "ERROR: db service is not running — start the stack first: docker compose up -d" >&2
  exit 1
fi

# --- read DB identity from .env (values only; no secrets are echoed) ---------
PG_USER="$(grep -E '^POSTGRES_USER=' .env | tail -n1 | cut -d= -f2- | tr -d '[:space:]')"
PG_DB="$(grep   -E '^POSTGRES_DB='   .env | tail -n1 | cut -d= -f2- | tr -d '[:space:]')"
PG_USER="${PG_USER:-patel}"
PG_DB="${PG_DB:-patelnetworks}"

# --- dump --------------------------------------------------------------------
mkdir -p "${BACKUP_DIR}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTFILE="${BACKUP_DIR}/${PG_DB}_${TIMESTAMP}.sql.gz"

echo "[backup] dumping ${PG_DB} (user ${PG_USER}) -> ${OUTFILE}"
# -T: no TTY (safe under cron). Single plain-SQL dump = maximally restorable.
"${COMPOSE[@]}" exec -T db pg_dump -U "${PG_USER}" -d "${PG_DB}" --no-owner --no-privileges \
  | gzip > "${OUTFILE}"

SIZE="$(du -h "${OUTFILE}" | cut -f1)"
echo "[backup] done: ${OUTFILE} (${SIZE})"

# --- retention: keep the last 7 daily backups --------------------------------
# (mtime-based pruning; adjust RETENTION_DAYS above or move to S3/off-VPS
#  storage for real disaster recovery — a VPS lost with its backups is 0 backups)
find "${BACKUP_DIR}" -maxdepth 1 -name '*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete \
  | sed 's/^/[backup] pruned: /' || true

echo "[backup] retention sweep complete (kept files newer than ${RETENTION_DAYS} days)"
