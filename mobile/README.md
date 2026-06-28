# Popup Hub — Capacitor iOS shell

Native iOS wrapper for the production web app at [https://popuphub.ca](https://popuphub.ca).

## Architecture

- **Bundle ID:** `ca.popuphub.app`
- **Launch URL:** `https://popuphub.ca/discover` (vendors with active vendor portal redirect to `/vendor/events` on native cold launch)
- **Web assets:** `mobile/www/` is a minimal offline fallback; production builds load the hosted site via `server.url` in `capacitor.config.ts`.
- **Auth / checkout:** Google OAuth opens in the **system browser** (`@capacitor/browser`) because Google blocks sign-in inside embedded WebViews; the app returns via the `ca.popuphub.app://auth/callback` deep link. Payment domains remain in `server.allowNavigation` for in-app checkout redirects.

Capacitor documents `server.url` as a dev/live-reload option. We use it intentionally for v1 so coordinator + vendor flows ship without a static Next.js export. See `PM/ios-testflight.md` for App Store review notes and a bundled-asset migration path.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| macOS + Xcode 16+ | Required to build, sign, and upload to TestFlight |
| Apple Developer Program | Enrolled — App ID + App Store Connect app |
| Node 20+ | Same as the main repo |
| CocoaPods | Not required (Capacitor 7 uses Swift Package Manager) |

Windows/Linux can edit config and run `npm run mobile:sync`; only Mac can open Xcode and archive.

## Quick start (Mac)

```bash
npm install
npm run assets:logo          # refresh PWA icons from master logo
npm run mobile:assets        # copy brand assets into mobile/www + ios resources
npm run mobile:sync          # cap sync ios
npm run mobile:ios:open      # open Xcode workspace
```

In Xcode:

1. Select target **App** → **Signing & Capabilities** → Team = your Apple Developer team.
2. Confirm bundle identifier `ca.popuphub.app`.
3. Product → Archive → Distribute App → App Store Connect → Upload.

Full TestFlight checklist: **`PM/ios-testflight.md`**.

**Android Play Console:** **`PM/android-play-console.md`**.

**Emulator / device testing (Android + iOS):** **`PM/mobile-emulator-setup.md`**.

**Store setup (developer accounts):** **`PM/mobile-store-setup.md`**.

## Quick start (Windows — Android)

```powershell
npm install
npm run mobile:android:debug    # sync + debug APK
npm run mobile:android:open     # Android Studio
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

## Local dev against staging

Point the shell at a preview or local HTTPS dev server:

```bash
# Preview deploy
CAPACITOR_SERVER_URL=https://your-preview.vercel.app npm run mobile:sync

# Local Next.js with HTTPS certs (see package.json dev:https)
CAPACITOR_SERVER_URL=https://localhost:3000 npm run mobile:sync
```

Rebuild or re-sync after changing `CAPACITOR_SERVER_URL`.

## OAuth (Supabase — Google, Apple, Microsoft, Facebook)

Full provider setup checklist: **`PM/oauth-provider-setup.md`**.

Register these redirect URLs in **Supabase Dashboard → Authentication → URL Configuration**:

```
ca.popuphub.app://auth/callback
https://popuphub.ca/api/auth/callback
https://popuphub.ca/**
```

(Add preview/staging origins as needed.) Login and signup use `lib/auth/native-oauth.ts` to open OAuth in the **system browser** on native (Google blocks embedded WebViews) and redirect back through the custom scheme above. Email/password sign-in remains available on the same pages.

After the iOS project exists, confirm `ios/App/App/Info.plist` contains the `CFBundleURLTypes` entry from `mobile/ios/url-scheme-snippet.plist` (applied automatically on first `mobile:assets` run when `ios/` is present).

## Files

| Path | Purpose |
|------|---------|
| `capacitor.config.ts` | App id, server URL, allowNavigation, splash/status bar |
| `mobile/www/` | Fallback HTML + copied brand PNG |
| `mobile/resources/` | Source splash + icon PNGs for iOS asset catalog |
| `scripts/mobile/generate-ios-resources.mjs` | Generates icons/splash + patches Info.plist URL scheme |
| `scripts/mobile/sync-ios.ps1` | Assets + `cap sync ios` wrapper |
| `ios/` | Generated Xcode project (after `npx cap add ios`) |
