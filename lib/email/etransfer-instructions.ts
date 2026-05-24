import { formatMarketDateDisplay } from '@/lib/events/format-market-date'
import { formatEtransferExpiryCountdown } from '@/lib/applications/etransfer-reference'
import { sendEmail } from '@/lib/email/send'
import { formatCents } from '@/lib/square/client'
import type { Event } from '@/types/database'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface EtransferInstructionEmailContext {
  vendorEmail: string
  vendorName: string
  marketName: string
  marketDate: string
  totalAmountCents: number
  coordinatorPaymentEmail: string
  referenceCode: string
  expiresAt: string
  coordinatorName?: string | null
}

export function buildEtransferInstructionEmail(ctx: EtransferInstructionEmailContext) {
  const totalFormatted = formatCents(ctx.totalAmountCents)
  const countdown = formatEtransferExpiryCountdown(ctx.expiresAt)
  const expiryLocal = new Date(ctx.expiresAt).toLocaleString('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const subject = `Complete your e-transfer — ${ctx.marketName} (${ctx.referenceCode})`

  const text = `Hello ${ctx.vendorName},

Your booth at ${ctx.marketName} is on hold for 24 hours while we verify your e-transfer.

Amount due: ${totalFormatted} (0% processing fees)
Send to: ${ctx.coordinatorPaymentEmail}
Memo / message: ${ctx.referenceCode}

Market date: ${ctx.marketDate}
Hold expires: ${expiryLocal} (${countdown})

Include the reference code exactly in your e-transfer memo so ${ctx.coordinatorName ?? 'the coordinator'} can match your payment. If we do not receive your transfer before the deadline, your spot may be released.

Questions? Reply to this email.

— Popup Hub`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;line-height:1.6;color:#1f2937;">
      <p>Hello ${escapeHtml(ctx.vendorName)},</p>
      <p>Your booth at <strong>${escapeHtml(ctx.marketName)}</strong> is on hold for <strong>24 hours</strong> while we verify your e-transfer.</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;color:#0369a1;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">Payment details</p>
        <p style="margin:0;"><strong>Amount due:</strong> ${escapeHtml(totalFormatted)} <span style="color:#059669;">(0% fees)</span></p>
        <p style="margin:8px 0 0;"><strong>Send to:</strong> ${escapeHtml(ctx.coordinatorPaymentEmail)}</p>
        <p style="margin:8px 0 0;"><strong>Memo / message:</strong> <code style="background:#e0f2fe;padding:2px 8px;border-radius:6px;font-size:15px;">${escapeHtml(ctx.referenceCode)}</code></p>
      </div>
      <p><strong>Market date:</strong> ${escapeHtml(ctx.marketDate)}</p>
      <p style="background:#fff7ed;border-left:4px solid #f97316;padding:12px 16px;border-radius:0 8px 8px 0;">
        ⏱ <strong>${escapeHtml(countdown)}</strong> — hold expires ${escapeHtml(expiryLocal)}. Your spot is only guaranteed until then pending manual verification.
      </p>
      <p>Include the reference code exactly in your e-transfer memo so the coordinator can match your payment.</p>
      <p>Questions? Reply to this email.</p>
      <p>— Popup Hub</p>
    </div>
  `.trim()

  return { subject, text, html }
}

export async function sendEtransferInstructionEmail(
  ctx: EtransferInstructionEmailContext
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!ctx.vendorEmail) {
    return { ok: false, error: 'Missing vendor email' }
  }
  if (!ctx.coordinatorPaymentEmail) {
    return { ok: false, error: 'Missing coordinator payment email' }
  }

  const { subject, text, html } = buildEtransferInstructionEmail(ctx)
  return sendEmail({
    to: ctx.vendorEmail,
    subject,
    html,
    text,
    replyTo: ctx.coordinatorPaymentEmail,
  })
}

export function buildEtransferInstructionContextFromEvent(params: {
  vendorEmail: string
  vendorName: string
  totalAmountCents: number
  referenceCode: string
  expiresAt: string
  coordinatorPaymentEmail: string
  coordinatorName?: string | null
  event: Pick<Event, 'name' | 'start_at' | 'end_at' | 'is_multi_day' | 'event_days'>
}): EtransferInstructionEmailContext {
  return {
    vendorEmail: params.vendorEmail,
    vendorName: params.vendorName,
    marketName: params.event.name,
    marketDate: formatMarketDateDisplay(params.event),
    totalAmountCents: params.totalAmountCents,
    coordinatorPaymentEmail: params.coordinatorPaymentEmail,
    referenceCode: params.referenceCode,
    expiresAt: params.expiresAt,
    coordinatorName: params.coordinatorName,
  }
}
