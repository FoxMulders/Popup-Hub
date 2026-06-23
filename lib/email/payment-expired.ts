import { sendEmail } from '@/lib/email/send'
import { publicAppUrl } from '@/lib/url/public-app-url'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface PaymentExpiredEmailContext {
  vendorEmail: string
  vendorName: string
  marketName: string
  applicationId: string
}

export function buildPaymentExpiredEmail(ctx: PaymentExpiredEmailContext) {
  const browseUrl = publicAppUrl('/vendor/applications')
  const subject = `Booth released — payment deadline passed (${ctx.marketName})`

  const text = `Hello ${ctx.vendorName},

We did not receive your booth payment for "${ctx.marketName}" before the deadline. Your application has been cancelled and the booth may be offered to another vendor.

You can browse other markets or re-apply if a spot is still available: ${browseUrl}

— Popup Hub`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;line-height:1.6;color:#1f2937;">
      <p>Hello ${escapeHtml(ctx.vendorName)},</p>
      <p>We did not receive your booth payment for <strong>${escapeHtml(ctx.marketName)}</strong> before the deadline.</p>
      <p style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:0 8px 8px 0;">
        Your application has been cancelled and the booth may be offered to another vendor on the waitlist.
      </p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${escapeHtml(browseUrl)}" style="display:inline-block;background:#57534e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">View my applications</a>
      </p>
      <p>— Popup Hub</p>
    </div>
  `.trim()

  return { subject, text, html }
}

export async function sendPaymentExpiredEmail(
  ctx: PaymentExpiredEmailContext
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!ctx.vendorEmail?.trim()) {
    return { ok: false, skipped: true }
  }
  const { subject, text, html } = buildPaymentExpiredEmail(ctx)
  return sendEmail({ to: ctx.vendorEmail, subject, html, text })
}
