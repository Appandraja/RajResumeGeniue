#!/usr/bin/env bash
# Deploy the latest code from GitHub (run on the server, as root):
#   sudo bash /opt/rajresumegenie/deploy/vps/update.sh
# Your data and secrets are kept: only containers are rebuilt. Migrations run on start.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_DIR/.env.production"
COMPOSE=(docker compose -f "$REPO_DIR/deploy/vps/docker-compose.prod.yml" --env-file "$ENV_FILE")

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE: run setup.sh first." >&2; exit 1; }

echo "==> Backing up the database before updating"
bash "$REPO_DIR/deploy/vps/backup.sh"

echo "==> Fetching the latest code"
git -C "$REPO_DIR" pull --ff-only

echo "==> Rebuilding and restarting"
"${COMPOSE[@]}" up -d --build
docker image prune -f >/dev/null

DOMAIN="$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"
for i in $(seq 1 36); do
  if curl -fsS -k --max-time 5 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/health" >/dev/null 2>&1; then
    echo "Updated and healthy: https://$DOMAIN/health"
    exit 0
  fi
  sleep 5
done
echo "Updated, but the health check failed. Logs: ${COMPOSE[*]} logs --tail 80" >&2
exit 1
