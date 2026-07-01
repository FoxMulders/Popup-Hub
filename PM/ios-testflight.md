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

### Sign in with Apple — server-to-server notifications

After deploying the web app, register Popup Hub’s notification endpoint in Apple Developer:

| Setting | Value |
|---------|-------|
| App ID | `ca.popuphub.app` |
| Sign in with Apple → Configure → **Server-to-Server Notification Endpoint** | `https://popuphub.ca/api/auth/apple/notifications` |

Apple POSTs signed JWTs when users revoke consent, delete their app account, or change private-relay email forwarding. The endpoint verifies Apple’s signature and updates Supabase Auth (delete user, unlink Apple identity, or log email relay changes).

Register the URL **after** production deploy so Apple can reach a live HTTPS endpoint (TLS 1.2+).

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
| Version | `1.184.0` (match `package.json`; auto-synced via `mobile:assets`) |
| Build | increment each upload via `build-number.json` → `iosBuild` (e.g. `25`; independent from web build counter) |
| Signing | Automatic + correct Team |
| Deployment Target | iOS 15+ (Capacitor 7 default) |

**Product → Archive** → **Distribute App** → **App Store Connect** → Upload.

Processing in App Store Connect usually takes 5–30 minutes.

**iOS build counter:** `build-number.json` → `iosBuild` (independent from the web `build` counter). The **Deploy to TestFlight** workflow auto-increments `iosBuild` before each archive (`scripts/bump-ios-build.mjs`), syncs `CURRENT_PROJECT_VERSION` via `mobile:assets`, and commits the new value back to `master` after a successful upload (`[skip ci]` avoids a deploy loop). For manual Mac archives, bump `iosBuild` yourself before uploading if App Store Connect rejects a duplicate build (ITMS-90189).

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
| 8 | Vendor launch | Vendor account cold launch → `/vendor/events` + bottom nav |
| 9 | Market alerts | Profile → set nearby alert radius; publish test market → in-app notification |
| 10 | Quick apply | Open market from notification → apply in one tap (instant-book) |

File issues with device model + iOS version + build number.

## 6. Routing App Coverage File (GeoJSON)

App Store Connect may require a **Routing App Coverage File** when location is used for market discovery. Upload the file from:

```
mobile/ios/routing-app-coverage.geojson
```

| Field | Value |
|-------|-------|
| Format | GeoJSON with a single `MultiPolygon` |
| Region | Canada (national market discovery coverage) |
| Upload | App Store Connect → your app → **App Information** → **Routing App Coverage File** |

Coordinates are `[longitude, latitude]` per the GeoJSON spec. The polygon is a simplified Canada-wide bounding box for App Store Connect routing coverage.

## 7. App Store review notes (when promoting beyond internal)

Apple Guideline **4.7** allows apps that run web content if they use standard WebKit and add native value. Draft review notes:

> Popup Hub connects market-goers and vendors to local popup markets. The iOS app wraps https://popuphub.ca with native splash, status bar, push notifications, geolocation for market discovery, and deep-link auth (`ca.popuphub.app://`). Patrons discover markets and interactive venue maps; vendors receive geo-matched alerts and apply for booths with passport-on-file instant book.

Avoid describing the app as “just a website wrapper.” Emphasize coordinator/vendor tooling and authenticated workflows.

## 8. Known limitations (v1)

- **Remote URL:** Updates ship with web deploys; offline mode is limited to the fallback page in `mobile/www/`.
- **Capacitor plugins:** Splash, status bar, app URL open, geolocation, push token registration.
- **Universal links:** `public/.well-known/apple-app-site-association` — replace `TEAM_ID` before production; deploy to popuphub.ca.
- **Windows CI:** Cannot archive iOS builds; use Mac locally or macOS CI (e.g. GitHub Actions + `macos-latest` + `fastlane` later).

## 8b. CI signing — manual App Store distribution (current approach)

The **Deploy to TestFlight** workflow uses **manual** distribution signing. This is deliberate: automatic signing (`-allowProvisioningUpdates`) on headless GitHub runners repeatedly drifted to *iOS App Development* profiles and minted a new certificate per run until the Apple certificate quota was exhausted (`Choose a certificate to revoke…`). Manual signing never contacts the portal to mint anything, so it is immune to both failures.

### How it works

- `project.pbxproj` Release configs (App + widget) pin `CODE_SIGN_STYLE = Manual`, `CODE_SIGN_IDENTITY = "Apple Distribution"`, and a `PROVISIONING_PROFILE_SPECIFIER`.
- CI imports one Apple Distribution `.p12` and installs **two** App Store profiles, then archives/exports with **no** `-allowProvisioningUpdates`.
- Debug configs stay Automatic so local Xcode dev is unaffected.

### Required GitHub secrets

| Secret | Contents |
|--------|----------|
| `BUILD_CERTIFICATE_BASE64` | base64 of your **one** Apple Distribution `.p12` (with private key) |
| `P12_PASSWORD` | password for that `.p12` |
| `BUILD_PROVISION_PROFILE_BASE64` | base64 of the **App** App Store profile (`.mobileprovision`) for `ca.popuphub.app` |
| `BUILD_WIDGET_PROVISION_PROFILE_BASE64` | base64 of the **widget** App Store profile for `ca.popuphub.app.PopupHubWidget` |
| `APP_STORE_CONNECT_KEY_ID` / `APP_STORE_CONNECT_ISSUER_ID` / `APP_STORE_CONNECT_API_KEY` | ASC API key — used **only** to authenticate the TestFlight upload |

### One-time setup in the Apple Developer portal

1. **Certificates** → confirm exactly **one** Apple Distribution cert; revoke surplus **Development** certs to clear the quota wall.
2. **Profiles → + → App Store** for **each** App ID:
   - `ca.popuphub.app` → name the profile **exactly** `PopupHub App Store`
   - `ca.popuphub.app.PopupHubWidget` → name it **exactly** `PopupHub Widget App Store`
   - Both must select the **same** Apple Distribution certificate above.
3. Download each `.mobileprovision`, then on a Mac/Linux: `base64 -i <file>.mobileprovision | pbcopy` and paste into the matching secret.
4. Export the distribution identity as `.p12` (Keychain Access → My Certificates → right-click → Export) → `base64 -i dist.p12` → `BUILD_CERTIFICATE_BASE64` (+ `P12_PASSWORD`).

5. **Validate before updating secrets** (Mac):
   ```bash
   chmod +x scripts/mobile/audit-apple-signing-assets.sh
   ./scripts/mobile/audit-apple-signing-assets.sh dist.p12 PopupHub_App_Store.mobileprovision PopupHub_Widget_App_Store.mobileprovision
   ```
   This checks App Store profile type (no `ProvisionedDevices`), confirms Apple Distribution (not Development), and verifies profile cert SHA-1 matches the `.p12`. CI runs the same checks automatically.

> The profile **names must match** the `PROVISIONING_PROFILE_SPECIFIER` values in `project.pbxproj` and the `provisioningProfiles` dict in `ios/App/App/ExportOptions.plist`. The workflow fails fast with an actionable error if a downloaded profile's name doesn't match. If you prefer different names, change them in all three places.

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank white screen | Confirm `https://popuphub.ca` reachable; check `allowNavigation` in `capacitor.config.ts` |
| OAuth loop | Add redirect URL in Supabase; verify URL scheme in Info.plist |
| “Untrusted Developer” on device | Settings → General → VPN & Device Management → trust developer cert (dev builds only) |
| Archive fails signing | Xcode → Settings → Accounts → Download Manual Profiles; select correct Team |
| GitHub Actions: `No signing certificate "iOS Distribution" found` | `BUILD_CERTIFICATE_BASE64` is missing the private key. On Mac: Keychain Access → My Certificates → expand `Apple Distribution: … (6ACBDTX7T7)` — must show a **private key** beneath. Right-click the identity → Export `.p12` (not the portal `.cer`). `base64 -i dist.p12 | pbcopy` → update repo secrets `BUILD_CERTIFICATE_BASE64` + `P12_PASSWORD`. Confirm `BUILD_PROVISION_PROFILE_BASE64` is an App Store profile for `ca.popuphub.app` on team `6ACBDTX7T7`. Re-run **Deploy to TestFlight**. |
| GitHub Actions: `security: problem decoding` on **Install App Store provisioning profiles** | `BUILD_PROVISION_PROFILE_BASE64` or `BUILD_WIDGET_PROVISION_PROFILE_BASE64` is invalid base64 or has stray whitespace from copy-paste. On Mac: `base64 -i PopupHub_App_Store.mobileprovision | pbcopy` → paste into the secret. Profile must be **App Store** type, named exactly `PopupHub App Store` / `PopupHub Widget App Store`. |
| GitHub Actions: `Your team has no devices` / `No profiles for 'ca.popuphub.app' were found` / `iOS App Development provisioning profiles` during **Release** archive | Automatic signing resolved to a **Development** profile. Common causes: `App.entitlements` has `aps-environment` set to `development` (remove until push is configured, or set `production` once Push is enabled on the App ID); stale manual profiles in `~/Library/MobileDevice/Provisioning Profiles/` (CI clears these before archive); missing explicit `CODE_SIGN_IDENTITY=Apple Distribution` on the Release target or archive step. Do not run `npm run mobile:assets` before shipping without confirming `App.entitlements` — `generate-ios-resources.mjs` must not re-add `aps-environment=development`. |
| App Store Connect: **ITMS-90035** (invalid signature) after upload | Binary was signed with a **Development** or **Ad Hoc** certificate, not **Apple Distribution**. **Before re-upload:** on Mac run `scripts/mobile/audit-apple-signing-assets.sh dist.p12 PopupHub_App_Store.mobileprovision PopupHub_Widget_App_Store.mobileprovision` — all three assets must pass; then refresh GitHub secrets (§8b). CI now fails fast on wrong profile type or cert/profile mismatch. In Xcode: target **Signing & Capabilities** → Release uses Manual + App Store profiles; **Product → Scheme → Edit Scheme → Archive → Build Configuration = Release**; clean build folder; archive with **Any iOS Device (arm64)**; bump **Build** before re-upload. Verify `App.entitlements` has no `aps-environment=development`. |
| TestFlight build missing | Check email for Apple processing errors; verify bundle id matches App Store Connect |

## Next after first internal build

1. Universal links + `apple-app-site-association` on production domain.
2. Push notifications (APNs) for market-day alerts.
3. Evaluate bundled static export or live-update for App Store compliance long term.

## 10. Manual completion checklist (after repo merge)

Use this once `node scripts/mobile/verify-testflight-signing-config.mjs` passes locally.

### A. Fix GitHub secrets (if CI fails at profile install)

1. Apple Developer → **Profiles** → download **App Store** profiles (not Development):
   - `PopupHub App Store` → `ca.popuphub.app`
   - `PopupHub Widget App Store` → `ca.popuphub.app.PopupHubWidget`
2. On Mac, for each file:
   ```bash
   base64 -i PopupHub_App_Store.mobileprovision | pbcopy
   ```
   Paste into `BUILD_PROVISION_PROFILE_BASE64` (repeat for widget → `BUILD_WIDGET_PROVISION_PROFILE_BASE64`).
3. Re-run **Actions → Deploy to TestFlight → Run workflow** (`workflow_dispatch` on `master`).

### B. Supabase (required for native sign-in)

Supabase Dashboard → **Authentication → URL Configuration**:

- Site URL: `https://popuphub.ca`
- Redirect URLs: `https://popuphub.ca/**`, `https://popuphub.ca/api/auth/callback`, `ca.popuphub.app://auth/callback`

### C. App Store Connect (after successful upload)

- [ ] **App Information** → upload [`mobile/ios/routing-app-coverage.geojson`](mobile/ios/routing-app-coverage.geojson)
- [ ] **TestFlight** → wait for build **12** / v**1.184.0** to finish processing
- [ ] Answer **Export Compliance** (typically No)
- [ ] **Internal Testing** → create group → add team Apple IDs → send invites

### D. Apple Sign in with Apple S2S (post-deploy)

Apple Developer → App ID `ca.popuphub.app` → Sign in with Apple → **Server-to-Server Notification Endpoint**:

`https://popuphub.ca/api/auth/apple/notifications`

Verify: `curl -s -o /dev/null -w "%{http_code}" -X POST https://popuphub.ca/api/auth/apple/notifications -H "Content-Type: application/json" -d '{}'` → expect **400** (not 404).

### E. Device smoke tests (`PM/ios-testflight.md` §5)

Install via TestFlight, then run flows 1–8 (required). Flows 9–10 (push/instant-book) are **v1 deferred** until APNs is enabled.
