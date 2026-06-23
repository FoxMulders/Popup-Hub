import { formatPaymentDueAtDisplay } from '@/lib/applications/payment-deadline'
import { sendEmail } from '@/lib/email/send'
import { formatCents } from '@/lib/square/client'
import { publicAppUrl } from '@/lib/url/public-app-url'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type PaymentReminderStage = 1 | 2 | 3

export interface PaymentDueReminderEmailContext {
  vendorEmail: string
  vendorName: string
  marketName: string
  paymentDueAt: string
  amountCents?: number | null
  stage: PaymentReminderStage
  applicationId: string
}

function stageCopy(stage: PaymentReminderStage): { subjectPrefix: string; urgency: string } {
  switch (stage) {
    case 1:
      return {
        subjectPrefix: 'Payment reminder',
        urgency: 'Your booth is approved — complete payment to keep your spot.',
      }
    case 2:
      return {
        subjectPrefix: 'Payment due soon',
        urgency: 'Your payment deadline is within 24 hours. Pay now to avoid losing your booth.',
      }
    case 3:
      return {
        subjectPrefix: 'Final payment notice',
        urgency:
          'This is your final reminder — your booth will be released if payment is not received within a few hours.',
      }
  }
}

export function buildPaymentDueReminderEmail(ctx: PaymentDueReminderEmailContext) {
  const { subjectPrefix, urgency } = stageCopy(ctx.stage)
  const dueDisplay = formatPaymentDueAtDisplay(ctx.paymentDueAt)
  const payUrl = publicAppUrl('/vendor/applications')
  const amountLine =
    typeof ctx.amountCents === 'number' && ctx.amountCents > 0
      ? `\nAmount due: ${formatCents(ctx.amountCents)}`
      : ''

  const subject = `${subjectPrefix} — ${ctx.marketName}`

  const text = `Hello ${ctx.vendorName},

${urgency}

Market: ${ctx.marketName}
Pay by: ${dueDisplay}${amountLine}

Complete payment in Popup Hub: ${payUrl}

If you have already paid, you can ignore this message — the organizer may still be verifying e-transfer or cash.

— Popup Hub`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;line-height:1.6;color:#1f2937;">
      <p>Hello ${escapeHtml(ctx.vendorName)},</p>
      <p>${escapeHtml(urgency)}</p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;color:#c2410c;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">Payment due</p>
        <p style="margin:0;"><strong>Market:</strong> ${escapeHtml(ctx.marketName)}</p>
        <p style="margin:8px 0 0;"><strong>Pay by:</strong> ${escapeHtml(dueDisplay)}</p>
        ${
          typeof ctx.amountCents === 'number' && ctx.amountCents > 0
            ? `<p style="margin:8px 0 0;"><strong>Amount:</strong> ${escapeHtml(formatCents(ctx.amountCents))}</p>`
            : ''
        }
      </div>
      <p style="text-align:center;margin:24px 0;">
        <a href="${escapeHtml(payUrl)}" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Pay now in Popup Hub</a>
      </p>
      <p style="font-size:13px;color:#6b7280;">Already paid? E-transfer and cash payments may take time for the organizer to confirm.</p>
      <p>— Popup Hub</p>
    </div>
  `.trim()

  return { subject, text, html }
}

export async function sendPaymentDueReminderEmail(
  ctx: PaymentDueReminderEmailContext
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!ctx.vendorEmail?.trim()) {
    return { ok: false, skipped: true }
  }
  const { subject, text, html } = buildPaymentDueReminderEmail(ctx)
  return sendEmail({ to: ctx.vendorEmail, subject, html, text })
}
