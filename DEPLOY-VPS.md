# Deploying on a Hostinger VPS (or any Ubuntu server)

Result: **https://srv1989774.hstgr.cloud** serves the web app and the API over HTTPS, with
PostgreSQL behind it. The Android app then works on **mobile data and any Wi-Fi**, with your PC off.

```
Internet --> Caddy (ports 80/443, automatic HTTPS)
                |-- /auth/*  /api/*  /health  --> API container --> PostgreSQL container
                '-- everything else           --> web app container
```

Only Caddy is reachable from the internet. The API and the database have no published ports.
Caddy discards any `X-Forwarded-For` the client sends and sets its own, so rate limits cannot be
dodged by forging that header (tested; see `deploy/vps/`).

## 0. Make sure the server is reachable (do this first)

When I probed `srv1989774.hstgr.cloud` (187.53.132.97) from outside, **nothing answered**: not
ping, not SSH (22), not 80/443. Before anything else, in **hPanel -> VPS -> your server**:

1. **Status** must be **Running**. If it is stopped or says "setting up", start it / wait.
2. **OS** should be **Ubuntu 22.04 or 24.04** (an "Ubuntu with Docker" template saves a step).
   If it is a different or fresh OS, you can reinstall from the VPS settings (this erases it).
3. **Security -> Firewall**: if a Hostinger firewall is enabled, allow inbound **TCP 22, 80 and
   443** (and UDP 443). A firewall with no rules drops everything.
4. Note the **SSH access** details (IP, user `root`) in case you prefer your own terminal.

## 1. Install (about 10 minutes, mostly waiting for the first build)

Open **hPanel -> VPS -> Browser terminal** (already logged in as you; nothing to type for a
password) and paste:

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone https://github.com/Appandraja/RajResumeGeniue.git /opt/rajresumegenie
cd /opt/rajresumegenie && sudo bash deploy/vps/setup.sh srv1989774.hstgr.cloud
```

`setup.sh` is safe to re-run. It installs Docker if missing, opens only ssh/80/443 in the
firewall, generates strong secrets into `/opt/rajresumegenie/.env.production` (never
overwritten), builds and starts everything, schedules a nightly database backup, and waits
until `https://srv1989774.hstgr.cloud/health` answers. It ends with `DONE. Live at: https://...`.

Then open https://srv1989774.hstgr.cloud, create an account, and try an import and an export.

## 2. Point the Android app at it

Send the address (or do it yourself): set the GitHub repository variables
`ANDROID_API_URL=https://srv1989774.hstgr.cloud` and `ANDROID_CAP_DEV=false`, run the
**Android APK** workflow, install the new APK (uninstall the old one first).

## 3. Everyday commands (run on the server)

| Task | Command |
|------|---------|
| Deploy the latest code | `sudo bash /opt/rajresumegenie/deploy/vps/update.sh` (backs up first) |
| See what is running | `cd /opt/rajresumegenie && sudo docker compose -f deploy/vps/docker-compose.prod.yml --env-file .env.production ps` |
| API logs | same command ending in `logs backend --tail 100` |
| Password-reset codes (while `EMAIL_BACKEND=console`) | `... logs backend \| grep "reset code"` |
| Manual backup | `sudo bash /opt/rajresumegenie/deploy/vps/backup.sh` |

Tip: define a shortcut once: `alias rg='sudo docker compose -f /opt/rajresumegenie/deploy/vps/docker-compose.prod.yml --env-file /opt/rajresumegenie/.env.production'`, then `rg ps`, `rg logs backend`.

## 4. If something goes wrong

| Symptom | Likely cause and fix |
|---------|----------------------|
| `setup.sh` finishes with "trusted HTTPS certificate is not available yet" | Check `... logs caddy --tail 60`. (a) DNS: `srv1989774.hstgr.cloud` must resolve to this server's IP. (b) Ports 80/443 blocked in the Hostinger firewall: Let's Encrypt must reach port 80. (c) **Let's Encrypt rate limits** on the shared `hstgr.cloud` name: use the IP-based name instead, e.g. `187-53-132-97.sslip.io` (replace dots with dashes), by editing `DOMAIN=` in `.env.production` and running `update.sh`. A name you own is best. |
| Build is killed / "out of memory" | 1 GB servers need swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Cannot reach the site but `setup.sh` said DONE | Hostinger firewall or a local network block; test from your phone on mobile data |
| Want to start over | `cd /opt/rajresumegenie && sudo docker compose -f deploy/vps/docker-compose.prod.yml --env-file .env.production down` (keeps data; add `-v` to ERASE the database) |

## 5. Before real users

- **Real email for password reset**: edit `.env.production`: `EMAIL_BACKEND=smtp` plus
  `SMTP_HOST/PORT/USERNAME/PASSWORD/FROM` (Hostinger email, Gmail app password, Brevo...), then
  `update.sh`. `console` mode writes reset codes to the server log: testing only.
- **Backups**: they sit on the same server. Turn on **Hostinger VPS backups/snapshots** in hPanel
  and copy `/opt/rajresumegenie/backups` somewhere else periodically.
- **SSH**: use key login, disable password login, and keep the OS updated
  (`sudo apt-get update && sudo apt-get upgrade`).
- **Google sign-in** needs `GOOGLE_CLIENT_ID/SECRET` and the redirect URI
  `https://srv1989774.hstgr.cloud/auth/google/callback` registered in Google Cloud Console.
- Keep `.env.production` private (it holds the database password and token-signing key).
