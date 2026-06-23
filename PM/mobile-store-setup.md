# Mobile apps — store setup (developer accounts ready)

You have Apple + Google developer accounts. Use this checklist to get **testable builds** on device.

## What’s already in the repo

| Item | Status |
|------|--------|
| Capacitor 7 shell (`ca.popuphub.app`) | ✅ Loads `https://popuphub.ca/discover` |
| iOS + Android native projects | ✅ `ios/`, `android/` |
| Plugins (push, geolocation, haptics) | ✅ Synced via `npm run mobile:sync` |
| Brand icons + splash | ✅ Generated on sync |
| OAuth deep link | ✅ `ca.popuphub.app://auth/callback` |
| Version sync | ✅ Matches `package.json` (currently 1.120.0) |
| Android debug APK script | ✅ `npm run mobile:android:debug` |

---

## Android — test today (Windows)

### 1. Emulator or physical device

**Emulator:** Android Studio → Device Manager → Create **Pixel 7**, API **35** → Start.

**Physical device:** Enable Developer options → USB debugging → connect USB.

### 2. Build & install

```powershell
npm run mobile:android:debug
# Or install directly to connected device/emulator:
powershell -ExecutionPolicy Bypass -File ./scripts/mobile/build-android-debug.ps1 -Install
```

APK path: `android/app/build/outputs/apk/debug/app-debug.apk`

Manual install: `adb install -r android\app\build\outputs\apk\debug\app-debug.apk`

### 3. Play Console — internal testing (signed release)

1. [Play Console](https://play.google.com/console) → **Create app** → Popup Hub, free.
2. Android Studio → **Build → Generate Signed Bundle/APK** → **Android App Bundle**.
3. Create an **upload keystore** (save password + file securely).
4. **Testing → Internal testing** → upload `.aab` → add tester emails.

Get release SHA-256 for App Links:

```powershell
keytool -list -v -keystore your-upload.keystore -alias your-alias
```

Then patch universal links and redeploy web:

```powershell
$env:ANDROID_SHA256_FINGERPRINT="AA:BB:..."
npm run mobile:store-links
# commit + deploy so https://popuphub.ca/.well-known/assetlinks.json updates
```

### 4. Push notifications (Android)

1. [Firebase Console](https://console.firebase.google.com) → Add Android app → `ca.popuphub.app`.
2. Download `google-services.json` → `android/app/google-services.json` (gitignored).
3. Copy **Cloud Messaging server key** → Vercel env `FCM_SERVER_KEY`.
4. `npm run mobile:sync` → rebuild.

See `android/app/google-services.json.example`.

---

## iOS — TestFlight (requires Mac)

iOS archives **cannot** be built on Windows. Use a Mac with Xcode 16+.

### 1. Apple Developer Portal

1. [developer.apple.com/account](https://developer.apple.com/account)
2. **Identifiers → +** → App ID `ca.popuphub.app` (enable **Push Notifications**, **Associated Domains**).
3. Xcode automatic signing can create certs/profiles on first archive.

### 2. App Store Connect

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps → +** → iOS app.
2. Bundle ID: `ca.popuphub.app`, SKU: `popuphub-ios-001`, Free.

### 3. Build on Mac

```bash
git pull
npm install
npm run mobile:sync
npm run mobile:ios:open
```

In Xcode (**App** target):

| Setting | Value |
|---------|-------|
| Team | Your Apple Developer team |
| Bundle ID | `ca.popuphub.app` |
| Version | 1.120.0 (auto-synced) |
| Build | Increment each upload |

**Product → Archive → Distribute → App Store Connect → Upload.**

### 4. TestFlight internal

App Store Connect → **TestFlight** → Internal group → add Apple IDs → install via TestFlight app.

Full smoke checklist: [`ios-testflight.md`](ios-testflight.md).

### 5. Universal links (iOS)

Get your **Team ID** (10 chars) from Apple Developer → Membership.

```powershell
$env:APPLE_TEAM_ID="AB12CD34EF"
npm run mobile:store-links
# deploy web — enables https://popuphub.ca links to open in app
```

Xcode: **Associated Domains** `applinks:popuphub.ca` is in `ios/App/App/App.entitlements`.

### 6. Push (APNs)

1. Apple Developer → Keys → **+** → Apple Push Notifications service (APNs).
2. Upload key to your push provider or wire server-side APNs (follow-up after FCM).
3. Enable Push capability in Xcode (matches entitlements).

---

## Supabase Auth (both platforms)

In Supabase → Authentication → URL configuration:

| Setting | Value |
|---------|-------|
| Site URL | `https://popuphub.ca` |
| Redirect URLs | `https://popuphub.ca/**`, `ca.popuphub.app://auth/callback` |

---

## Smoke test (both apps)

| # | Flow | Pass |
|---|------|------|
| 1 | Cold launch | Splash → `/discover` |
| 2 | Browse | Open an event from discover |
| 3 | Sign in | Email/password completes in app |
| 4 | Vendor | Sign in → `/vendor/events`, bottom nav |
| 5 | Quick apply | Instant-book market submits |
| 6 | Alerts | Profile → nearby market radius saves |
| 7 | Resume | Background app → session persists |

---

## Commands reference

| Task | Command |
|------|---------|
| Sync native projects | `npm run mobile:sync` |
| Android debug build | `npm run mobile:android:debug` |
| Open Android Studio | `npm run mobile:android:open` |
| Open Xcode (Mac) | `npm run mobile:ios:open` |
| Patch store link files | `npm run mobile:store-links` |
| Local dev URL | `$env:CAPACITOR_SERVER_URL="http://10.0.2.2:3000"; npm run mobile:sync` |

More detail: [`mobile/README.md`](../mobile/README.md), [`mobile-emulator-setup.md`](mobile-emulator-setup.md).
