# Tipsy Fox Creations Inc. — Contract & Billing Transfer Checklist

**Status:** Pending (external — after incorporation)  
**Owner action:** Brad & Sonia M.  
**Goal:** Move all Popup Hub and Tipsy Fox platform billing to **Tipsy Fox Creations Inc.**

Complete after Articles of Incorporation are filed and a business bank account is open.

---

## Domains & DNS

- [ ] Transfer or register `popuphub.ca` billing to Tipsy Fox Creations Inc.
- [ ] Transfer or register `popuphub.app` billing to Tipsy Fox Creations Inc.
- [ ] Enable registrar lock + 2FA on domain accounts
- [ ] Confirm WHOIS reflects corp name (or privacy service with corp as registrant)

---

## Infrastructure

| Service | Action | Notes |
|---|---|---|
| **GitHub** | [ ] Transfer `FoxMulders/Popup-Hub` to org owned by corp, or document corp as owner | Keep private |
| **Vercel** | [ ] Move project to Vercel team billed to Tipsy Fox Creations Inc. | Production: popuphub.ca |
| **Supabase** | [ ] Update billing profile to corp name + corp card | Project: Popup Hub |
| **Google Cloud** | [ ] Maps API billing to corp; confirm referrer restrictions on `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | See `PM/ip-access-hardening.md` |

---

## Payments & communications

| Service | Action | Notes |
|---|---|---|
| **Square** | [ ] Update Square Developer application owner to Tipsy Fox Creations Inc. | Already Tipsy Fox branded — `lib/platform/operator.ts` |
| **Resend** | [ ] Billing + domain verification under corp | Outbound: `noreply@popuphub.app` |
| **Twilio** | [ ] Billing profile to corp | SMS alerts |
| **Stripe** | [ ] If activated later — corp billing | Currently inactive for platform fees |

---

## Email addresses

- [ ] Configure `legal@popuphub.app` — see `PM/legal-email-setup-checklist.md`
- [ ] Confirm `privacy@popuphub.app` and `accessibility@popuphub.app` forward or inbox

---

## Business records

- [ ] Store login credentials and contract PDFs in corp records (not in git)
- [ ] Update insurance (commercial general liability) to include SaaS platform operations if applicable
- [ ] Accounting: separate GL codes for Popup Hub platform revenue vs. Tipsy Fox vendor retail (optional, same corp)

---

**After completion:** Record transfer date below.

**Completed:** _______________
