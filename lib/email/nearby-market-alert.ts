import { sendEmail } from '@/lib/email/send'
import { publicAppUrl } from '@/lib/url/public-app-url'

export interface NearbyMarketAlertEmailContext {
  vendorEmail: string
  vendorName: string
  marketCount: number
  marketNames: string[]
  radiusKm: number
  deepLink: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildNearbyMarketAlertEmail(ctx: NearbyMarketAlertEmailContext) {
  const isDigest = ctx.marketCount > 1
  const subject = isDigest
    ? `${ctx.marketCount} new markets match your alert (${ctx.radiusKm} km)`
    : `New market near you — ${ctx.marketNames[0] ?? 'Popup Hub'}`

  const list = ctx.marketNames.map((name) => `• ${name}`).join('\n')
  const htmlList = ctx.marketNames
    .map((name) => `<li>${escapeHtml(name)}</li>`)
    .join('')

  const text = isDigest
    ? `Hi ${ctx.vendorName},

${ctx.marketCount} new markets within ${ctx.radiusKm} km match your category and location alerts:

${list}

Browse and apply: ${publicAppUrl(ctx.deepLink)}

— Popup Hub`
    : `Hi ${ctx.vendorName},

A new market within ${ctx.radiusKm} km matches your alert:

${ctx.marketNames[0]}

Apply now: ${publicAppUrl(ctx.deepLink)}

— Popup Hub`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.6;color:#1f2937;">
      <p>Hi ${escapeHtml(ctx.vendorName)},</p>
      ${
        isDigest
          ? `<p><strong>${ctx.marketCount} new markets</strong> within ${ctx.radiusKm} km match your category and location alerts:</p><ul>${htmlList}</ul>`
          : `<p>A new market within ${ctx.radiusKm} km matches your alert:</p><p><strong>${escapeHtml(ctx.marketNames[0] ?? 'New market')}</strong></p>`
      }
      <p><a href="${publicAppUrl(ctx.deepLink)}">Browse open markets →</a></p>
      <p style="color:#6b7280;font-size:12px;">Manage alerts in Profile → Market alerts.</p>
    </div>
  `.trim()

  return { subject, text, html }
}

export async function sendNearbyMarketAlertEmail(
  ctx: NearbyMarketAlertEmailContext
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!ctx.vendorEmail.trim()) {
    return { ok: false, error: 'Missing vendor email' }
  }
  const { subject, text, html } = buildNearbyMarketAlertEmail(ctx)
  return sendEmail({ to: ctx.vendorEmail, subject, text, html })
}
