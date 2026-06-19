# Popup Hub — Google Play (Android) checklist

Mirror of iOS TestFlight path for the same Capacitor shell (`ca.popuphub.app`).

## 1. Prerequisites

- Android Studio with SDK **API 35** (compile) — see [`android/variables.gradle`](../android/variables.gradle)
- `android/local.properties` with `sdk.dir=...` (copy from [`android/local.properties.example`](../android/local.properties.example))
- Java 17+ (bundled with current Android Studio)

## 2. Build & run locally

```powershell
npm install
npm run mobile:assets
npm run mobile:sync
npm run mobile:android:open
```

In Android Studio: create/start AVD → **Run**.

See [`PM/mobile-emulator-setup.md`](mobile-emulator-setup.md) for emulator setup on Windows.

## 3. Play Console app

1. [play.google.com/console](https://play.google.com/console) → **Create app**
2. App name: **Popup Hub**
3. Default language: English
4. App or game: **App**
5. Free / paid: **Free**

## 4. Store listing (draft)

- **Short description:** Discover markets. Apply in one tap.
- **Full description:** Patron discover + vendor geo-alerts + one-tap booth applications.
- **Category:** Shopping or Business
- **Screenshots:** `/discover`, `/vendor/events` with Apply CTA, notification deep link
- **Privacy policy:** https://popuphub.ca/legal/privacy

## 5. Data safety

Declare:

- **Location** — optional, for “near me” browse and opt-in vendor market alerts (static home base)
- **Account info** — email via Supabase auth
- **Device IDs** — push notification tokens when user grants permission

## 6. App signing

1. Android Studio → **Build → Generate Signed Bundle/APK**
2. Create upload keystore (keep safe — required for all future updates)
3. Play App Signing: let Google manage app signing key (recommended)
4. Update [`public/.well-known/assetlinks.json`](../public/.well-known/assetlinks.json) with release SHA-256 fingerprint

## 7. Internal testing track

1. Play Console → **Testing → Internal testing**
2. Upload `.aab` from signed release build
3. Add tester email list
4. Share opt-in link

### Smoke-test (internal)

| # | Flow | Pass |
|---|------|------|
| 1 | Cold launch | Splash → `/discover` |
| 2 | Vendor | Sign in → `/vendor/events`, bottom nav |
| 3 | Alerts | Profile → market alert prefs |
| 4 | Apply | Quick apply on instant-book market |
| 5 | Push | Register token (logcat); FCM when `FCM_SERVER_KEY` set on server |

## 8. Environment

| Variable | Purpose |
|----------|---------|
| `FCM_SERVER_KEY` | Server-side Android push dispatch ([`lib/mobile/push-dispatch.ts`](../lib/mobile/push-dispatch.ts)) |

APNs for iOS is a separate follow-up.

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| SDK location unknown | Create `android/local.properties` from example |
| Gradle sync fail | File → Sync Project; confirm API 35 installed |
| White WebView | Check `CAPACITOR_SERVER_URL` / internet on emulator |
| Push not received | Confirm `FCM_SERVER_KEY` on Vercel; token in `device_push_tokens` |
