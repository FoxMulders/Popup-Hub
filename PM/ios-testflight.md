# Popup Hub — iOS TestFlight (internal) checklist

Use this after scaffolding the Capacitor shell (`mobile/README.md`). Builds and signing require **macOS + Xcode**.

## 1. Apple Developer Portal

1. Sign in at [developer.apple.com/account](https://developer.apple.com/account).
2. **Identifiers → App IDs → +**  
   - Description: `Popup Hub`  
   - Bundle ID: **Explicit** → `ca.popuphub.app`  
   - Capabilities (enable as needed later): Push Notifications, Associated Domains (for universal links).
3. **Certificates → + → Apple Distribution** (or use Xcode automatic signing).
4. **Profiles → + → App Store Connect** → select `ca.popuphub.app` + Distribution cert.

Xcode automatic signing can create items 3–4 on first archive if your Apple ID has Admin/App Manager access.

## 2. App Store Connect

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps → + → New App**.
2. Platform: **iOS**  
   Name: **Popup Hub**  
   Primary language: English (Canada) or English (U.S.)  
   Bundle ID: `ca.popuphub.app`  
   SKU: `popuphub-ios-001` (any unique string).
3. **App Information → Category:** Business or Shopping.
4. **Pricing:** Free.

## 3. Supabase Auth redirect

In Supabase → Authentication → URL configuration, add:

| Setting | Value |
|---------|-------|
| Site URL | `https://popuphub.ca` |
| Redirect URLs | `https://popuphub.ca/**`, `ca.popuphub.app://auth/callback` |

Test sign-in on device after first TestFlight install. If OAuth opens Safari instead of returning to the app, verify `Info.plist` URL scheme and Supabase redirect list.

## 4. Build on Mac

```bash
git pull
npm install
npm run assets:logo
npm run mobile:sync
npm run mobile:ios:open
```

In Xcode (**App** target):

| Setting | Value |
|---------|-------|
| Display Name | Popup Hub |
| Bundle Identifier | `ca.popuphub.app` |
| Version | `1.0.0` (match `package.json` until release process) |
| Build | increment each upload (e.g. `165` to match web build or independent iOS counter) |
| Signing | Automatic + correct Team |
| Deployment Target | iOS 15+ (Capacitor 7 default) |

**Product → Archive** → **Distribute App** → **App Store Connect** → Upload.

Processing in App Store Connect usually takes 5–30 minutes.

## 5. TestFlight — internal testing

1. App Store Connect → your app → **TestFlight**.
2. Wait for build processing → answer **Export Compliance** (typically “No” for HTTPS-only content).
3. **Internal Testing** → create group → add Apple IDs on your team (up to 100, no Beta App Review).
4. Install **TestFlight** on iPhone/iPad → accept invite → install **Popup Hub**.

### Smoke-test script (internal)

| # | Flow | Pass criteria |
|---|------|---------------|
| 1 | Cold launch | Splash → `/discover` loads; no “server.url” dev toast |
| 2 | Browse | Scroll `/discover`, open an event detail |
| 3 | Sign-in | Email/password or OAuth completes; lands in app (not stuck in Safari) |
| 4 | Coordinator | `/coordinator/dashboard` — initial room modal, canvas pan/zoom |
| 5 | Safe area | Notch/home indicator do not clip footer or bottom nav |
| 6 | External link | Legal/privacy opens in-app or Safari per product rules |
| 7 | Background | Resume app → session persists (Supabase cookies) |

File issues with device model + iOS version + build number.

## 6. App Store review notes (when promoting beyond internal)

Apple Guideline **4.7** allows apps that run web content if they use standard WebKit and add native value. Draft review notes:

> Popup Hub is a market-operations tool for event coordinators and vendors. The iOS app wraps our authenticated web application served from https://popuphub.ca. Native shell provides App Store distribution, splash screen, status bar integration, and deep-link auth (`ca.popuphub.app://`). Primary users manage floor plans, vendor booths, and market-day workflows. No gambling or HTML5 game catalog.

Avoid describing the app as “just a website wrapper.” Emphasize coordinator/vendor tooling and authenticated workflows.

## 7. Known limitations (v1)

- **Remote URL:** Updates ship with web deploys; offline mode is limited to the fallback page in `mobile/www/`.
- **Capacitor plugins:** Only used for splash/status bar in v1; most UI is standard WKWebView.
- **Universal links:** Not configured yet — add `apple-app-site-association` on `popuphub.ca` before relying on HTTPS OAuth return without custom scheme.
- **Windows CI:** Cannot archive iOS builds; use Mac locally or macOS CI (e.g. GitHub Actions + `macos-latest` + `fastlane` later).

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank white screen | Confirm `https://popuphub.ca` reachable; check `allowNavigation` in `capacitor.config.ts` |
| OAuth loop | Add redirect URL in Supabase; verify URL scheme in Info.plist |
| “Untrusted Developer” on device | Settings → General → VPN & Device Management → trust developer cert (dev builds only) |
| Archive fails signing | Xcode → Settings → Accounts → Download Manual Profiles; select correct Team |
| TestFlight build missing | Check email for Apple processing errors; verify bundle id matches App Store Connect |

## Next after first internal build

1. Universal links + `apple-app-site-association` on production domain.
2. Push notifications (APNs) for market-day alerts.
3. Evaluate bundled static export or live-update for App Store compliance long term.
