# Popup Hub — OAuth provider setup (Supabase Auth)

**Personas:** Patron · Vendor · Coordinator · `/login`, `/signup`, native app (`ca.popuphub.app`)

Popup Hub uses **Supabase Auth** for user sign-in. Do **not** use Auth0 for login — Auth0 is not wired into this app.

Supported methods on `/login` and `/signup`:

| Method | Configured in |
|--------|----------------|
| Email + password | Supabase → Authentication → Providers → Email |
| Google | Supabase → Providers → Google |
| Apple | Supabase → Providers → Apple + Apple Developer |
| Microsoft | Supabase → Providers → Azure |
| Facebook | Supabase → Providers → Facebook + Meta Developer |

Code paths: `lib/auth/native-oauth.ts` → Supabase OAuth → `/api/auth/callback` (web) or `ca.popuphub.app://auth/callback` (native).

---

## 1. Supabase URL configuration

**Supabase Dashboard → Authentication → URL Configuration**

| Setting | Value |
|---------|-------|
| Site URL | `https://popuphub.ca` |
| Redirect URLs | `https://popuphub.ca/**` |
| | `https://popuphub.ca/api/auth/callback` |
| | `ca.popuphub.app://auth/callback` |

Add Vercel preview URLs if you test on preview deploys.

Copy the **Callback URL** shown on each provider page (typically `https://<project-ref>.supabase.co/auth/v1/callback`) — paste it into Apple, Azure, Facebook, and Google consoles.

---

## 2. Vercel production env

Set in **Vercel → Project → Settings → Environment Variables** (Production):

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SITE_URL` | `https://popuphub.ca` | OAuth redirect origin, OG/canonical URLs |
| `NEXT_PUBLIC_SUPABASE_URL` | *(existing)* | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(existing)* | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | *(existing)* | Apple S2S webhook user lifecycle |
| `APPLE_BUNDLE_ID` | `ca.popuphub.app` | Apple S2S JWT audience (optional; defaults to bundle id) |
| `APPLE_SERVICES_ID` | e.g. `ca.popuphub.app.web` | Apple S2S JWT audience when using a Services ID |

**Note:** `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` in Vercel are for **coordinator Google Docs import**, not user Google login. User Google sign-in is configured in **Supabase → Providers → Google**.

---

## 3. Google (user sign-in)

1. **Google Cloud Console** → APIs & Services → Credentials → OAuth 2.0 Client (Web).
2. **Authorized redirect URIs:** Supabase callback URL from step 1.
3. **Supabase → Providers → Google:** paste Client ID and Client Secret; enable provider.
4. For **native iOS/Android:** OAuth opens the **system browser** (not the in-app WebView) — already implemented in `lib/auth/native-oauth.ts`.

If Google blocks sign-in in the Capacitor app, confirm `NEXT_PUBLIC_SITE_URL=https://popuphub.ca` and that Supabase redirect URLs include the native deep link.

---

## 4. Microsoft (Azure AD)

1. **Azure Portal** → [App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) → **New registration**.
   - Name: `Popup Hub`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: **Web** → Supabase callback URL
2. **Certificates & secrets** → New client secret → copy value.
3. **API permissions** → Microsoft Graph → Delegated: `openid`, `email`, `profile` (grant admin consent if required).
4. **Supabase → Providers → Azure:** enable; paste Application (client) ID and secret.

---

## 5. Facebook

1. **Meta for Developers** → [Create app](https://developers.facebook.com/apps/) → type **Consumer** (or app with Facebook Login).
2. **Facebook Login → Settings → Valid OAuth Redirect URIs:** Supabase callback URL.
3. **App Mode:** switch to **Live** before production users can sign in (Development mode only allows test users).
4. **Supabase → Providers → Facebook:** enable; paste App ID and App Secret.

Native app: Facebook domains are already in `capacitor.config.ts` `allowNavigation`.

---

## 6. Apple (Sign in with Apple)

### 6a. Apple Developer — identifiers

1. **Identifiers → App IDs:** `ca.popuphub.app` with **Sign in with Apple** enabled (see `PM/ios-testflight.md`).
2. **Identifiers → Services IDs → +**
   - Description: `Popup Hub Web`
   - Identifier: e.g. `ca.popuphub.app.web`
   - Enable **Sign in with Apple** → Configure:
     - Primary App ID: `ca.popuphub.app`
     - **Return URLs:** Supabase callback URL
3. **Keys → +** → enable **Sign in with Apple** → download `.p8` key (once). Note **Key ID** and **Team ID**.

### 6b. Apple client secret (JWT)

Generate a client secret JWT (valid ~6 months). Supabase docs: [Auth Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple).

Use the Services ID as `client_id` in the JWT. Rotate before expiry.

### 6c. Supabase

**Supabase → Providers → Apple:** enable; paste Services ID, secret JWT, Key ID, Team ID.

### 6d. Server-to-server notifications (post-deploy)

After production deploy, in Apple Developer → App ID `ca.popuphub.app` → Sign in with Apple → Configure:

| Setting | Value |
|---------|-------|
| Server-to-Server Notification Endpoint | `https://popuphub.ca/api/auth/apple/notifications` |

Handler: `app/api/auth/apple/notifications/route.ts` — verifies Apple JWTs and updates Supabase Auth on account delete / consent revoke.

---

## 7. Email + password (must stay enabled)

**Supabase → Providers → Email:** keep enabled.

Signup flow: `/signup` → email + password + terms → confirmation email (Resend SMTP in Supabase Auth settings).

Login flow: `/login` → email + password below the OAuth buttons.

Do not disable Email provider when enabling OAuth providers.

---

## 8. Smoke test checklist

After deploy and provider configuration:

### Web (`https://popuphub.ca`)

- [ ] `/login` — four OAuth buttons visible
- [ ] `/login` — email/password form works
- [ ] `/signup` — email/password signup + confirmation email
- [ ] Each OAuth button: opens provider → returns signed in to `/discover` (or redirect target)
- [ ] `/signup` OAuth requires terms acceptance first

### Native (`ca.popuphub.app`)

- [ ] OAuth opens **Safari/Chrome** (system browser), not embedded WebView
- [ ] Returns via `ca.popuphub.app://auth/callback` and completes session

### Apple S2S (optional)

- [ ] `POST https://popuphub.ca/api/auth/apple/notifications` with invalid body returns `400`; invalid JWT returns `401` (proves route is live)

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| OAuth redirect to wrong domain | Set `NEXT_PUBLIC_SITE_URL=https://popuphub.ca` in Vercel production |
| `Provider not enabled` | Enable provider in Supabase Dashboard |
| Facebook works in dev only | Switch Meta app to **Live** mode |
| Apple secret expired | Regenerate JWT client secret (6-month rotation) |
| Google blocked in iOS app | Use system browser flow (already in code); verify Supabase redirect URLs |
| Email signup broken | Check Supabase Auth SMTP (Resend) and Email provider enabled |

Related docs: `mobile/README.md`, `PM/ios-testflight.md`.
