# Mobile app — emulator & device testing

Use this guide to test **Patron + Vendor** flows on Android (Windows-friendly) and iOS (Mac required).

## What you are testing

The Capacitor shell loads the hosted web app (`https://popuphub.ca` by default, or a local/preview URL). Native pieces added in this release:

- Patron: `/discover`, event map, favorites
- Vendor: `/vendor/events`, quick apply, market alert prefs on `/profile`
- Push token registration API (full APNs/FCM delivery is a follow-up)

---

## Prerequisites (all platforms)

```powershell
cd C:\Users\bradm\Projects\popup-hub
npm install
```

Optional — test against **local Next.js** instead of production:

```powershell
npm run dev
# or HTTPS (recommended for geolocation + PWA APIs):
npm run dev:https
```

Point the shell at local dev:

```powershell
$env:CAPACITOR_SERVER_URL="http://10.0.2.2:3000"   # Android emulator → host machine
# or
$env:CAPACITOR_SERVER_URL="https://localhost:3000"   # iOS simulator / some Android setups
npm run mobile:assets
npm run mobile:sync
```

> **Android emulator note:** `10.0.2.2` is the special alias to your PC's `localhost` from the Android Virtual Device (AVD).

---

## Android emulator (Windows)

### 1. Install Android Studio

1. Download [Android Studio](https://developer.android.com/studio).
2. Run the installer; include **Android SDK**, **SDK Platform**, and **Android Virtual Device**.
3. Open Android Studio → **More Actions → Virtual Device Manager**.
4. Create a device (recommended: **Pixel 7**, API **34** or **35**, Google APIs image).

### 2. Add the Android platform (once)

```powershell
npm run mobile:android:add
npm run mobile:assets
$env:CAPACITOR_SERVER_URL="https://popuphub.ca/discover"   # or your preview URL
npm run mobile:sync
```

This creates the `android/` folder and copies config from [`capacitor.config.ts`](../capacitor.config.ts).

### 3. Run on the emulator

**Option A — Android Studio (easiest first time)**

```powershell
npm run mobile:android:open
```

In Android Studio: select your AVD → **Run** (green play).

**Option B — CLI**

```powershell
npm run mobile:android:run
```

### 4. Android smoke checklist

| Step | Action | Expected |
|------|--------|----------|
| 1 | Cold launch | Lands on `/discover` |
| 2 | Sign in as vendor | Portal switcher shows Patron + Vendor |
| 3 | Switch to Vendor → Markets | `/vendor/events`, bottom nav visible |
| 4 | Profile → New markets nearby | Save location + radius |
| 5 | Open a market → Apply in one tap | Instant-book markets submit (or full form fallback) |
| 6 | Notifications | Nearby market alert opens event when tapped |

### 5. Troubleshooting Android

| Issue | Fix |
|-------|-----|
| White screen | Check `CAPACITOR_SERVER_URL` reachable from emulator; use `10.0.2.2` for local dev |
| SSL errors on localhost | Use `npm run dev:https` or test against `https://popuphub.ca` |
| Geolocation denied | Grant location permission in emulator **Settings → Location** |
| Gradle sync fails | Open Android Studio → **File → Sync Project with Gradle Files** |

---

## iOS Simulator (Mac only)

iOS builds **cannot** be archived on Windows. Use a Mac (or cloud Mac) for Simulator and TestFlight.

### 1. Install Xcode

- Mac App Store → **Xcode 16+**
- `xcode-select --install` if needed

### 2. Add iOS platform (once)

```bash
npm run mobile:ios:add
npm run mobile:assets
npm run mobile:sync
npm run mobile:ios:open
```

### 3. Run in Simulator

In Xcode: choose **iPhone 16** (or similar) → **Run**.

For local dev:

```bash
CAPACITOR_SERVER_URL=https://localhost:3000 npm run mobile:sync
```

### 4. TestFlight (physical device)

Full checklist: [`PM/ios-testflight.md`](ios-testflight.md).

---

## Browser-only mobile preview (no emulator)

Fast iteration without Android Studio:

1. `npm run dev`
2. Chrome DevTools → **Toggle device toolbar** (Ctrl+Shift+M)
3. Choose **iPhone 14 Pro** or **Pixel 7**
4. Visit:
   - `http://localhost:3000/discover`
   - `http://localhost:3000/vendor/events`
5. Run Playwright mobile viewport tests when added:

```powershell
npx playwright test tests/e2e/public-discovery.spec.ts --project=chromium
```

---

## Supabase / backend for alerts & apply

Before testing **nearby market alerts**:

1. Apply migration: `npm run db:push` (includes `112_vendor_mobile_alerts.sql`)
2. As a vendor: **Profile → New markets nearby → Use current location**
3. As a coordinator: publish a draft market with valid lat/lng within the vendor radius
4. Vendor should receive an in-app notification (`nearby_market_published`)

---

## Environment variables (production shell)

No extra env vars are required for the WebView shell. Push delivery (APNs/FCM) will need platform keys in a later step — token registration is wired at `POST /api/mobile/push/register`.

---

## Quick reference

| Task | Command |
|------|---------|
| Sync native projects | `npm run mobile:sync` |
| Open Android Studio | `npm run mobile:android:open` |
| Open Xcode | `npm run mobile:ios:open` |
| Point at preview | `$env:CAPACITOR_SERVER_URL="https://your-preview.vercel.app"; npm run mobile:sync` |
| Production URL | Default in `capacitor.config.ts` → `https://popuphub.ca/discover` |
