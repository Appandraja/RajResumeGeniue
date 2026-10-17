# Deploying RajResumeGenie publicly (Render)

This puts the API and its PostgreSQL database on the internet over HTTPS, so the Android app
works on **mobile data and any Wi-Fi**, with your PC switched off. `render.yaml` describes
everything; Render builds it from this repo.

## What it costs

| Piece | Free plan (default in `render.yaml`) | Paid plan for real use |
|-------|--------------------------------------|------------------------|
| API (web service) | Free, but **sleeps after ~15 min idle**: the next request waits ~30-60 s | `starter`, always on |
| PostgreSQL | Free, but **expires after ~30 days and its data is deleted** | `basic-256mb`, kept and backed up |
| Web app (static site) | Free | Free |

Prices change: check https://render.com/pricing. Free is fine to **try** this out. Move to the
paid plans before real users (edit the two `plan:` lines in `render.yaml`, or change the plan in
the dashboard later).

## 1. Create the services (you, ~10 minutes)

1. Sign up at https://render.com (the "Sign in with GitHub" option is easiest). It may ask for a
   card even for free services.
2. **New +** -> **Blueprint** -> connect GitHub and choose **Appandraja/RajResumeGeniue**,
   branch **main**. (The repo is public, so Render can read it.)
3. Render shows what it will create: `rajresumegenie-db`, `rajresumegenie-api`,
   `rajresumegenie-web`. It will ask for values marked "sync: false" (SMTP and Google). **Leave
   them all empty** for now and click **Apply**.
4. Wait for the first build (about 5-10 minutes). Watch **rajresumegenie-api -> Logs**; you
   should see the three migrations, `Seed complete`, then `Uvicorn running`.
5. Open `https://rajresumegenie-api.onrender.com/health` in a browser. You should see
   `{"status":"healthy"}`.
   *If Render gave the API a different name/URL (names are global), copy the real URL; the next
   step needs it.*

## 2. Hand the URL to Claude (or do it yourself)

Send the API URL. Then:

1. Set the GitHub repository variables `ANDROID_API_URL` to that **https** URL and
   `ANDROID_CAP_DEV` to `false`.
2. **Calibrate the proxy setting** (below).
3. Re-run the **Android APK** workflow, download the APK, install it. It now talks to the
   internet, not your PC.

If the API URL differs from `rajresumegenie-api.onrender.com`, also update `CORS_ORIGINS`,
`FRONTEND_URL` and the web app's `VITE_API_URL` in the Render dashboard (and redeploy).

## 3. Calibrate the proxy setting (important, one time)

Render puts a load balancer in front of the API. The app rate-limits by client address, so it
must know how many proxies sit in front of it (`TRUSTED_PROXY_HOPS`). Too low and every user
shares one limit; too high and callers could forge their address.

With `DEBUG_CLIENT_IP=true` (already set by the blueprint) the API echoes what it sees:

```powershell
# Your real public address
$mine = (Invoke-RestMethod https://api.ipify.org)
# Send a request with a fake leading entry and read the server's view
$r = Invoke-WebRequest https://rajresumegenie-api.onrender.com/health -Headers @{ "X-Forwarded-For" = "9.9.9.9" } -UseBasicParsing
$r.Headers["X-Debug-Forwarded-For"]; $r.Headers["X-Debug-Client-IP"]; $mine
```

Read `X-Debug-Forwarded-For` from the right. It looks like `9.9.9.9, <your address>, <maybe a
proxy>`. **`TRUSTED_PROXY_HOPS` is how many places from the right your real address is** (1 if
it is last, 2 if one proxy address follows it). `X-Debug-Client-IP` must equal your real public
address. Set the value in the dashboard, redeploy, check again, then set
`DEBUG_CLIENT_IP=false`.

## 4. Before real users

- **Email for password reset.** `EMAIL_BACKEND=console` only writes the code to the Render log
  (only you can see it). For real users use a mail provider (Gmail app password, Brevo,
  SendGrid...): set `EMAIL_BACKEND=smtp` and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`,
  `SMTP_PASSWORD`, `SMTP_FROM`.
- **Paid database** so data isn't deleted after 30 days, and decide on backups.
- **Always-on API plan** so the first request isn't a 30-60 s wait.
- **Google sign-in** needs `GOOGLE_CLIENT_ID/SECRET` and a redirect URI of
  `https://<your-api>/auth/google/callback` registered in Google Cloud Console. Custom-scheme
  deep links can be hijacked by other apps; prefer verified Android App Links before a Play
  Store release.
- **Release signing** for the Play Store (see `frontend/ANDROID.md`).
- Set a billing alert in Render so nothing surprises you.
