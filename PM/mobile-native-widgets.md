# Native home-screen widgets

Role-aware **WidgetKit** (iOS) and **App Widget + Glance** (Android) extensions for Popup Hub.

## Architecture

1. User signs in inside the Capacitor webview.
2. `syncNativeWidgetSession()` mints a revocable token via `POST /api/widget/token` and saves token + snapshot through the **WidgetBridge** plugin (App Group / SharedPreferences).
3. Widget extensions call `GET /api/widget/feed` with `Authorization: Bearer <token>`.
4. Interactive actions (check-in, filter toggle, broadcast, incident log) call `POST /api/widget/action`.
5. Sign-out revokes tokens and clears native storage.

## API routes

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/widget/token` | Web session | Mint/rotate widget token + snapshot |
| `DELETE /api/widget/token` | Web session | Revoke all widget tokens |
| `GET /api/widget/feed` | Bearer token | Role-aware widget payload |
| `POST /api/widget/action` | Bearer token | refresh, checkin, toggleFilter, broadcast, incident, vendorMessage |

## iOS setup (Mac + Xcode)

1. Enable **App Groups** `group.ca.popuphub.app` on App + PopupHubWidgetExtension targets (entitlements committed).
2. After `npm run mobile:sync:ios`, run `node scripts/mobile/patch-ios-widget.mjs` (also runs automatically from `sync-ios.ps1`).
3. Archive **App** — the widget extension embeds automatically.
4. Add widget from home screen: **Popup Hub** (small / medium / large).

App Intents (iOS 17+): refresh, vendor check-in, patron filter toggle, coordinator broadcast — see `ios/PopupHubWidget/WidgetIntents.swift`.

## Android setup

1. `npm run mobile:android:debug`
2. Long-press home screen → Widgets → **Popup Hub**
3. WorkManager refreshes every 30 minutes; opening the app re-syncs the token.

## Database migrations

- `130_widget_tokens.sql` — hashed revocable widget tokens
- `131_widget_backfill.sql` — incidents, vendor messages, broadcasts, widget prefs, interest daily

Apply with `npm run db:push`.

## Persona payloads

- **Patron:** nearby/favorite markets, countdown, vendor of the day, feed snippets, notifications
- **Vendor:** wallet balance, application/payment status, active market, daily interest, notifications
- **Coordinator:** event pulse, pending apps, booth fees, check-in progress, occupancy, approval queue, vendor message snippet

Deep links use `https://popuphub.ca/...` (Android App Links) and Universal Links / custom scheme on iOS.
