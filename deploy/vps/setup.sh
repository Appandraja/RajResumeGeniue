#!/usr/bin/env bash
# One-shot, re-runnable setup for a fresh Ubuntu/Debian VPS (tested layout: Hostinger KVM VPS).
#
#   git clone https://github.com/Appandraja/RajResumeGeniue.git /opt/rajresumegenie
#   cd /opt/rajresumegenie && sudo bash deploy/vps/setup.sh <your-domain>
#
# What it does: installs Docker (if missing), opens ONLY ssh/80/443 in the firewall, creates
# .env.production with freshly generated secrets (never overwritten on re-runs), builds and starts
# the stack, installs a nightly database backup, and waits until https://<domain>/health works.
set -euo pipefail

DOMAIN="${1:-${DOMAIN:-}}"
if [ -z "$DOMAIN" ]; then
  echo "Usage: sudo bash deploy/vps/setup.sh <domain>   e.g. srv1989774.hstgr.cloud" >&2
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root (sudo bash deploy/vps/setup.sh $DOMAIN)." >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_DIR/.env.production"
COMPOSE_FILE="$REPO_DIR/deploy/vps/docker-compose.prod.yml"
say() { printf '\n==> %s\n' "$*"; }

say "1/6 System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git openssl ufw

say "2/6 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin
fi
systemctl enable --now docker
docker --version
docker compose version

say "3/6 Firewall (ssh, 80, 443 only)"
SSH_PORT="$( (sshd -T 2>/dev/null | awk '/^port /{print $2; exit}') || true )"
SSH_PORT="${SSH_PORT:-22}"
ufw allow "${SSH_PORT}/tcp"   # allowed BEFORE enabling, so you cannot lock yourself out
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
ufw status | sed 's/^/    /'

say "4/6 Configuration (.env.production)"
if [ -f "$ENV_FILE" ]; then
  echo "    $ENV_FILE already exists: keeping your secrets."
  if ! grep -q "^DOMAIN=$DOMAIN\$" "$ENV_FILE"; then
    echo "    WARNING: DOMAIN in $ENV_FILE differs from '$DOMAIN'. Edit it if that is not intended."
  fi
else
  umask 077
  cp "$REPO_DIR/deploy/vps/.env.production.example" "$ENV_FILE"
  PGPASS="$(openssl rand -hex 24)"
  SECRET="$(openssl rand -hex 32)"
  sed -i "s|^DOMAIN=.*|DOMAIN=$DOMAIN|" "$ENV_FILE"
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PGPASS|" "$ENV_FILE"
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$SECRET|" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "    Created $ENV_FILE with new random secrets (mode 600)."
fi

say "5/6 Build and start (first build takes several minutes)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

say "6/6 Nightly database backup"
chmod +x "$REPO_DIR"/deploy/vps/*.sh
cat >/etc/cron.d/rajresumegenie-backup <<CRON
15 3 * * * root $REPO_DIR/deploy/vps/backup.sh >>/var/log/rajresumegenie-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/rajresumegenie-backup
echo "    Backups: $REPO_DIR/backups (kept 14 days). Run now: bash $REPO_DIR/deploy/vps/backup.sh"

say "Waiting for the app (certificate issuance can take a minute)"
APP_OK=0
for i in $(seq 1 36); do
  if curl -fsS -k --max-time 5 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/health" >/dev/null 2>&1; then
    APP_OK=1
    break
  fi
  sleep 5
done
if [ "$APP_OK" -ne 1 ]; then
  echo "The app did not become healthy. Logs:  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs --tail 80" >&2
  exit 1
fi
echo "    App is up inside the server."

CERT_OK=0
for i in $(seq 1 24); do
  if curl -fsS --max-time 8 "https://$DOMAIN/health" >/dev/null 2>&1; then
    CERT_OK=1
    break
  fi
  sleep 5
done

echo
if [ "$CERT_OK" -eq 1 ]; then
  echo "DONE. Live at: https://$DOMAIN   (health: https://$DOMAIN/health)"
else
  echo "The app runs, but a trusted HTTPS certificate is not available yet for $DOMAIN."
  echo "Check:  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs caddy --tail 60"
  echo "Common causes: DNS for $DOMAIN does not point at this server, ports 80/443 blocked in the"
  echo "Hostinger firewall (hPanel > VPS > Security), or Let's Encrypt rate limits for shared names."
fi
echo "Password-reset codes (EMAIL_BACKEND=console):  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs backend | grep 'reset code'"
