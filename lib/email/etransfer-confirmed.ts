import { formatMarketDateDisplay } from '@/lib/events/format-market-date'
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

export interface EtransferConfirmedEmailContext {
  vendorEmail: string
  vendorName: string
  marketName: string
  marketDate: string
  totalAmountCents: number
  referenceCode: string
}

export async function sendEtransferConfirmedEmail(
  ctx: EtransferConfirmedEmailContext
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!ctx.vendorEmail) return { ok: false, error: 'Missing vendor email' }

  const totalFormatted = formatCents(ctx.totalAmountCents)
  const subject = `Payment confirmed — ${ctx.marketName}`

  const text = `Hello ${ctx.vendorName},

Your e-transfer for ${ctx.marketName} has been confirmed (${totalFormatted}, ref ${ctx.referenceCode}).

Your booth is secured. Market date: ${ctx.marketDate}

See you at the market!
— Popup Hub`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;line-height:1.6;color:#1f2937;">
      <p>Hello ${escapeHtml(ctx.vendorName)},</p>
      <p>Your e-transfer for <strong>${escapeHtml(ctx.marketName)}</strong> has been confirmed.</p>
      <p><strong>Amount:</strong> ${escapeHtml(totalFormatted)}<br />
      <strong>Reference:</strong> ${escapeHtml(ctx.referenceCode)}</p>
      <p>✅ Your booth is secured.<br />
      <strong>Market date:</strong> ${escapeHtml(ctx.marketDate)}</p>
      <p>See you at the market!<br />— Popup Hub</p>
    </div>
  `.trim()

  return sendEmail({ to: ctx.vendorEmail, subject, html, text })
}

export function buildEtransferConfirmedContext(params: {
  vendorEmail: string
  vendorName: string
  totalAmountCents: number
  referenceCode: string
  event: Pick<Event, 'name' | 'start_at' | 'end_at' | 'is_multi_day' | 'event_days'>
}): EtransferConfirmedEmailContext {
  return {
    vendorEmail: params.vendorEmail,
    vendorName: params.vendorName,
    marketName: params.event.name,
    marketDate: formatMarketDateDisplay(params.event),
    totalAmountCents: params.totalAmountCents,
    referenceCode: params.referenceCode,
  }
}
