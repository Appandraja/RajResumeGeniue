#!/usr/bin/env bash
# Dump the PostgreSQL database to a compressed file and keep the last 14 days.
# setup.sh schedules this nightly at 03:15. Run it by hand any time:
#   sudo bash /opt/rajresumegenie/deploy/vps/backup.sh
#
# Restore (replaces current data!):
#   gunzip -c backups/<file>.sql.gz | docker compose -f deploy/vps/docker-compose.prod.yml \
#     --env-file .env.production exec -T db psql -U rajresumegenie -d rajresumegenie
#
# NOTE: backups live on the same server. For real safety copy them elsewhere (another machine or
# object storage), and enable Hostinger's VPS snapshots/backups in hPanel.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_DIR/.env.production"
OUT_DIR="$REPO_DIR/backups"
mkdir -p "$OUT_DIR"

PGUSER="$(grep '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2-)"
PGDB="$(grep '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2-)"
STAMP="$(date +%Y-%m-%d-%H%M)"
FILE="$OUT_DIR/rajresumegenie-$STAMP.sql.gz"

umask 077
docker compose -f "$REPO_DIR/deploy/vps/docker-compose.prod.yml" --env-file "$ENV_FILE" \
  exec -T db pg_dump -U "${PGUSER:-rajresumegenie}" "${PGDB:-rajresumegenie}" | gzip >"$FILE"

# An empty or truncated dump is worse than none: fail loudly.
if [ "$(gzip -dc "$FILE" | wc -c)" -lt 200 ]; then
  rm -f "$FILE"
  echo "Backup failed: dump was empty." >&2
  exit 1
fi

find "$OUT_DIR" -name 'rajresumegenie-*.sql.gz' -mtime +14 -delete
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
