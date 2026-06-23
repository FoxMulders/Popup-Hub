# Popup Hub — legal@popuphub.app Setup Checklist

**Status:** Pending (external — DNS + email provider)  
**Goal:** Route `legal@popuphub.app` to an inbox Brad monitors for contractual notices and IP reports.

---

## Recommended setup (Resend — already used for transactional email)

Popup Hub sends mail via Resend (`lib/email/send.ts`, default `noreply@popuphub.app`). Add a receiving route or forwarder:

### Option A — Resend receiving (if enabled on your plan)

- [ ] Verify `popuphub.app` domain in Resend (may already be verified for outbound)
- [ ] Configure inbound route for `legal@popuphub.app` → forward to your monitored inbox
- [ ] Test: send email to `legal@popuphub.app` and confirm delivery

### Option B — Domain registrar / DNS forwarder

- [ ] Add MX records or email forwarding at your `popuphub.app` registrar
- [ ] Forward `legal@popuphub.app` → Brad's monitored inbox
- [ ] Also confirm these addresses resolve (already referenced in prod):
  - [ ] `privacy@popuphub.app` (Privacy Policy)
  - [ ] `accessibility@popuphub.app` (Accessibility Statement)

### Option C — Google Workspace / Microsoft 365

- [ ] Create `legal@popuphub.app` mailbox on corp domain (after incorporation)

---

## Code references (already updated to legal@popuphub.app)

| Location | Address |
|---|---|
| `lib/legal/contacts.ts` | `LEGAL_CONTACT_EMAIL` |
| `app/legal/terms/page.tsx` | Contact + copyright reports |
| `components/legal/legal-document.tsx` | Legal page footer |
| `lib/legal/faq-content.tsx` | Support FAQ |
| `LICENSE` | Licensing inquiries |

**Note:** Platform operator / Square billing email (`thetipsyfoxyeg@gmail.com` in `lib/platform/operator.ts`) is separate from legal contact — do not change unless consolidating business entities.

---

## After setup

- [ ] Send test email to `legal@popuphub.app`
- [ ] Mark this checklist complete
- [ ] Update `PM/ip-access-hardening.md` if needed
