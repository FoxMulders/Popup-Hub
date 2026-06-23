# Popup Hub — Entity & IP Assignment Checklist

**Status:** Pending (external — requires lawyer + Alberta registry)  
**Owner action:** Brad M.  
**Goal:** A single legal entity owns all Popup Hub intellectual property.

---

## 1. Incorporate in Alberta

- [ ] Choose corporate name (e.g. **Popup Hub Inc.** or numbered Alberta corp + registered business name "Popup Hub")
- [ ] File Articles of Incorporation via [Alberta Corporate Registry](https://www.alberta.ca/corporate-registry) or a registry agent
- [ ] Obtain Business Number (BN) from CRA
- [ ] Open business bank account in the corporation's name
- [ ] Transfer platform contracts to the corp:
  - [ ] Vercel team / project ownership
  - [ ] Supabase project billing
  - [ ] Square application (The Tipsy Fox operator — decide corp vs existing entity)
  - [ ] Domain registrar (`popuphub.ca`) — enable registrar lock + 2FA
  - [ ] Resend / Twilio / other SaaS billing

**Estimated cost:** ~$300–$800 government/registry fees + ~$1,000–$2,000 legal (2026 ballpark)

---

## 2. IP Assignment Deed

Have a lawyer draft and execute an **Intellectual Property Assignment Agreement** from:

| Assignor | Assignee |
|---|---|
| Brad M. (sole developer / author) | [Alberta corporation name] |
| Sonia M. (if contributing marketing copy, creative assets) | Same corporation |

**Assets to assign explicitly:**

- All source code in `FoxMulders/Popup-Hub` and deployment artifacts
- Database schemas and migrations (`supabase/migrations/`)
- Marketing copy (`lib/legal/about-content.ts`, `lib/marketing/origin-story.ts`)
- Logos and brand assets (`public/`, HubGuard assets)
- Venue blueprint registry (`lib/booth-planner/edmonton-venue-registry.ts`)
- Domain names and social accounts
- Trade secrets listed in `PM/trade-secrets-register.md`

- [ ] Signed IP assignment deed on file (corp records)
- [ ] Update `LICENSE` copyright line to corporation legal name once formed
- [ ] Update Terms of Service "Platform ownership" section with corp legal name

---

## 3. Until incorporation (interim)

- Git history documents Brad M. as sole author — **do not rewrite history**
- Keep GitHub repo **private**; no collaborator access without NDA + IP assignment
- Do not open-source any core modules

---

## 4. Future partners / contractors

Before granting repo or production access:

- [ ] Signed NDA
- [ ] Work-for-hire / IP assignment naming the corporation as owner
- [ ] Unanimous shareholder agreement if adding equity partners (vesting, IP stays with corp)

---

**After completion:** Update this checklist status, `LICENSE` holder name, and Terms § Platform ownership entity name.
