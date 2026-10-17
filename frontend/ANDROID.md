# RajResumeGenie for Android

The Android app is the same React app wrapped with [Capacitor](https://capacitorjs.com/) and
talks to the same FastAPI backend.

- **Package:** `com.rajresumegenie.app`
- **Minimum OS:** Android 13 (API 33). **Target / compile SDK:** 35.
- **Native pieces:** Google sign-in through the system browser + deep link, resume export via the
  Android share sheet.

## 1. Point the app at your backend

A phone cannot reach `localhost` on your PC. Copy `.env.android.example` to `.env.android` and set
`VITE_API_URL`:

| Scenario | `VITE_API_URL` | Extra |
|----------|----------------|-------|
| Production / release | `https://api.your-domain.com` | HTTPS required |
| Emulator (debug) | `http://10.0.2.2:8000` | run sync with `CAP_DEV=true` |
| Real phone on LAN (debug) | `http://<pc-lan-ip>:8000` | run sync with `CAP_DEV=true` |

## 2. Backend settings the app needs

```env
# The bundled app is served from https://localhost inside the WebView
CORS_ORIGINS=https://localhost
# Google Cloud Console: keep GOOGLE_REDIRECT_URI as the backend callback URL
GOOGLE_REDIRECT_URI=https://api.your-domain.com/auth/google/callback
```

Google sign-in in the app opens the system browser at `/auth/google?client=mobile`; the backend
then redirects to `rajresumegenie://auth/callback#access_token=...`, which reopens the app.

## 3. Build

Requirements: Node 20+, **JDK 21**, and the Android SDK (easiest: install Android Studio).

```bash
cd frontend
npm ci
npm run android:sync          # builds the web app and copies it into android/
npm run android:open          # opens Android Studio -> Run, or build an APK there
```

Command line debug APK (Linux/macOS: `./gradlew`):

```bash
cd android
gradlew.bat assembleDebug     # -> app/build/outputs/apk/debug/app-debug.apk
```

Debug build against a plain-HTTP dev backend:

```bash
CAP_DEV=true npm run android:sync     # PowerShell: $env:CAP_DEV="true"; npm run android:sync
```

### No local Android tooling?

The **Android APK** GitHub Actions workflow builds a debug APK on every change under `frontend/`
(or on demand: Actions -> Android APK -> Run workflow). Set the repository variable
`ANDROID_API_URL` to your HTTPS backend URL first. Download the APK from the run's artifacts.

## 4. Release signing (Play Store)

Debug APKs are for testing only. For release, create a keystore **outside the repo**, reference it
from `android/keystore.properties` (git-ignored, as are `*.jks` and `*.keystore`), and build
`bundleRelease`. Never commit signing keys.

## Known limitations

- **Deep link scheme can be claimed by another app.** `rajresumegenie://` is a custom scheme; for
  production prefer verified Android App Links (`https://` + `assetlinks.json`) or a PKCE flow.
- Tokens are stored in the WebView's `localStorage` (same as the web app); backups are disabled in
  the manifest so they are not copied off the device.
- Not yet tested on a physical device or emulator: layout under edge-to-edge (status bar insets),
  and the share-sheet export flow.
