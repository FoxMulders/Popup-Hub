# Tipsy Fox Creations Inc. — Entity & IP Assignment Checklist

**Status:** Pending (external — requires lawyer + Alberta registry)  
**Owner action:** Brad & Sonia M.  
**Goal:** **Tipsy Fox Creations Inc.** owns all IP for The Tipsy Fox (vendor brand) and Popup Hub (platform brand) under one Alberta corporation.

**Decision:** Single entity for simplicity — no separate Popup Hub Inc.

---

## 0. Confirm corporate name availability

- [ ] Search [Alberta Corporate Registry](https://www.alberta.ca/corporate-registry) NUANS / name search for **Tipsy Fox Creations Inc.**
- [ ] Search CIPO trademarks for conflicting "Tipsy Fox" marks in relevant classes
- [ ] Confirm with registry agent or lawyer that the name is available before filing
- [ ] Optional registered business names (after incorporation):
  - [ ] **Popup Hub** — platform invoices/contracts
  - [ ] **The Tipsy Fox** — if not covered by corporate name

**Record search date and result here:** _______________

---

## 1. Incorporate in Alberta

- [ ] File Articles of Incorporation for **Tipsy Fox Creations Inc.** via registry agent or [Alberta Corporate Registry](https://www.alberta.ca/corporate-registry)
- [ ] Obtain Business Number (BN) from CRA
- [ ] Open business bank account in **Tipsy Fox Creations Inc.**
- [ ] Document share structure (Brad & Sonia — lawyer can draft unanimous shareholder agreement if needed)

**Estimated cost:** ~$300–$800 government/registry fees + ~$1,000–$2,000 legal (2026 ballpark)

**Do not form a second corporation for Popup Hub.**

---

## 2. IP Assignment Deed

Have a lawyer draft and execute an **Intellectual Property Assignment Agreement** from:

| Assignor | Assignee |
|---|---|
| Brad M. (sole developer / author) | **Tipsy Fox Creations Inc.** |
| Sonia M. (marketing copy, creative assets) | **Tipsy Fox Creations Inc.** |

**Assets to assign explicitly:**

- All source code in `FoxMulders/Popup-Hub` and deployment artifacts
- Database schemas and migrations (`supabase/migrations/`)
- Marketing copy (`lib/legal/about-content.ts`, `lib/marketing/origin-story.ts`)
- Logos and brand assets — Popup Hub, HubGrid, HubGuard, The Tipsy Fox (`public/`, HubGuard assets)
- Venue blueprint registry (`lib/booth-planner/edmonton-venue-registry.ts`)
- Domain names (`popuphub.ca`, `popuphub.app`) and social accounts
- Trade secrets listed in `PM/trade-secrets-register.md`
- Amazon associate tag and Square application assets tied to the platform

- [ ] Signed IP assignment deed on file (corp records)
- [x] Repo legal copy updated — `LICENSE`, Terms §1/§6, footer (`lib/legal/entity.ts`)
- [ ] Mark deed completion date: _______________

---

## 3. Until incorporation completes (interim)

- Git history documents Brad M. as sole author — **do not rewrite history**
- Repo asserts **Tipsy Fox Creations Inc.** as intended legal owner in `LICENSE` and Terms
- Keep GitHub repo **private**; no collaborator access without NDA + IP assignment
- Do not open-source any core modules

---

## 4. Future partners / contractors

Before granting repo or production access:

- [ ] Signed NDA naming **Tipsy Fox Creations Inc.**
- [ ] Work-for-hire / IP assignment to **Tipsy Fox Creations Inc.**
- [ ] Unanimous shareholder agreement if adding equity partners (vesting, IP stays with corp)

---

## Brand structure (reference)

| Layer | Name | Role |
|---|---|---|
| Legal owner | Tipsy Fox Creations Inc. | Copyright, trademarks, contracts |
| Platform brand | Popup Hub | Consumer-facing SaaS product |
| Sub-brands | HubGrid, HubGuard, Vendor Passport | Product features (trademarked by corp) |
| Vendor brand | The Tipsy Fox | Retail/maker brand under same corp |

---

**After completion:** Record incorporation date and BN in this doc; file CIPO marks per `PM/ip-trademark-filing-checklist.md`; transfer contracts per `PM/ip-contract-transfer-checklist.md`.
