import { format } from 'date-fns'
import { sendEmail } from '@/lib/email/send'
import {
  buildGoogleCalendarUrl,
  buildIcsBlob,
  type CalendarEventPayload,
} from '@/lib/shopper/calendar-export'
import { publicAppUrl } from '@/lib/url/public-app-url'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface VendorApprovalEmailContext {
  vendorEmail: string
  vendorName: string
  marketName: string
  applicationId: string
  calendar: CalendarEventPayload
}

export function buildVendorApprovalEmail(ctx: VendorApprovalEmailContext) {
  const applicationsUrl = publicAppUrl('/vendor/applications')
  const googleUrl = buildGoogleCalendarUrl(ctx.calendar)
  const icsBlob = buildIcsBlob(ctx.calendar)
  const startsDisplay = format(ctx.calendar.startsAt, 'EEE, MMM d, yyyy h:mm a')

  const subject = `Booth approved — ${ctx.marketName}`

  const text = `Hello ${ctx.vendorName},

Your booth application for "${ctx.marketName}" has been approved!

Market day: ${startsDisplay}
${ctx.calendar.location ? `Location: ${ctx.calendar.location}\n` : ''}
View your application: ${applicationsUrl}
Add to Google Calendar: ${googleUrl}

See you at the market!

— Popup Hub`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;line-height:1.6;color:#1f2937;">
      <p>Hello ${escapeHtml(ctx.vendorName)},</p>
      <p>Your booth application for <strong>${escapeHtml(ctx.marketName)}</strong> has been approved!</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;color:#166534;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">Market day</p>
        <p style="margin:0;">${escapeHtml(startsDisplay)}</p>
        ${
          ctx.calendar.location
            ? `<p style="margin:8px 0 0;">${escapeHtml(ctx.calendar.location)}</p>`
            : ''
        }
      </div>
      <p style="margin:16px 0;">
        <a href="${escapeHtml(googleUrl)}" style="color:#2d5a27;font-weight:600;">Add to Google Calendar</a>
        ·
        <a href="${escapeHtml(applicationsUrl)}" style="color:#2d5a27;font-weight:600;">View application</a>
      </p>
      <p style="color:#6b7280;font-size:13px;">See you at the market!</p>
    </div>`

  return { subject, text, html, icsBlob }
}

export async function sendVendorApprovalEmail(ctx: VendorApprovalEmailContext): Promise<void> {
  const email = buildVendorApprovalEmail(ctx)
  await sendEmail({
    to: ctx.vendorEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  })
}
