import { formatMarketDateDisplay } from '@/lib/events/format-market-date'
import { sendEmail } from '@/lib/email/send'
import type { Event } from '@/types/database'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface MarketApplicationEmailContext {
  vendorEmail: string
  vendorName: string
  marketName: string
  marketDate: string
  coordinatorEmail: string | null
}

export function buildMarketApplicationReceivedEmail(ctx: MarketApplicationEmailContext) {
  const subject = `Market Application Received - ${ctx.marketName}`

  const text = `Hello ${ctx.vendorName},

Thank you for submitting your market application on Popup Hub!

Your vendor passport has been successfully attached, and the event organizer has been notified of your submission for:

📍 Market Name: ${ctx.marketName}
📅 Date: ${ctx.marketDate}

If the organizer requires full-weekend attendance or flags a multi-category exception, they will review your profile details accordingly.

If this category fills up before your application is processed, you will automatically be positioned on the event waitlist and notified immediately if a spot opens up due to a cancellation.

For any immediate modifications or questions regarding your booth requirements, please reply directly to this email to get in touch with the event coordinator.

Best regards,
The Popup Hub Team`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;line-height:1.6;color:#1f2937;">
      <p>Hello ${escapeHtml(ctx.vendorName)},</p>
      <p>Thank you for submitting your market application on Popup Hub!</p>
      <p>Your vendor passport has been successfully attached, and the event organizer has been notified of your submission for:</p>
      <p>
        📍 <strong>Market Name:</strong> ${escapeHtml(ctx.marketName)}<br />
        📅 <strong>Date:</strong> ${escapeHtml(ctx.marketDate)}
      </p>
      <p>If the organizer requires full-weekend attendance or flags a multi-category exception, they will review your profile details accordingly.</p>
      <p>If this category fills up before your application is processed, you will automatically be positioned on the event waitlist and notified immediately if a spot opens up due to a cancellation.</p>
      <p>For any immediate modifications or questions regarding your booth requirements, please reply directly to this email to get in touch with the event coordinator.</p>
      <p>Best regards,<br />The Popup Hub Team</p>
    </div>
  `.trim()

  return { subject, text, html }
}

export function resolveVendorDisplayName(
  passport: { business_name?: string | null } | null,
  profile: { full_name?: string | null } | null
): string {
  const businessName = passport?.business_name?.trim()
  if (businessName) return businessName

  const fullName = profile?.full_name?.trim()
  if (fullName) return fullName

  return 'Vendor'
}

export function resolveCoordinatorEmail(
  coordinator: { email?: string | null } | { email?: string | null }[] | null | undefined
): string | null {
  const row = Array.isArray(coordinator) ? coordinator[0] : coordinator
  const email = row?.email?.trim()
  return email || null
}

export async function sendMarketApplicationReceivedEmail(
  ctx: MarketApplicationEmailContext
): Promise<void> {
  if (!ctx.vendorEmail) {
    console.warn('[email] market application received: missing vendor email; skipping')
    return
  }

  const { subject, text, html } = buildMarketApplicationReceivedEmail(ctx)

  try {
    const result = await sendEmail({
      to: ctx.vendorEmail,
      subject,
      html,
      text,
      replyTo: ctx.coordinatorEmail ?? undefined,
    })

    if (!result.ok && !result.skipped) {
      console.error('[email] market application received failed:', result.error, {
        to: ctx.vendorEmail,
        market: ctx.marketName,
      })
    }
  } catch (err) {
    console.error('[email] market application received dispatch error:', err, {
      to: ctx.vendorEmail,
      market: ctx.marketName,
    })
  }
}

export function buildMarketApplicationEmailFromEvent(params: {
  vendorEmail: string
  passport: { business_name?: string | null } | null
  profile: { full_name?: string | null } | null
  event: Pick<Event, 'name' | 'start_at' | 'end_at' | 'is_multi_day' | 'event_days'> & {
    coordinator?: { email?: string | null } | { email?: string | null }[] | null
  }
}): MarketApplicationEmailContext {
  return {
    vendorEmail: params.vendorEmail,
    vendorName: resolveVendorDisplayName(params.passport, params.profile),
    marketName: params.event.name,
    marketDate: formatMarketDateDisplay(params.event),
    coordinatorEmail: resolveCoordinatorEmail(params.event.coordinator),
  }
}
