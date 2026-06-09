import { sendEmail } from '@/lib/email/send'
import { publicAppUrl } from '@/lib/url/public-app-url'

export async function sendPriorityBoothInviteEmail(params: {
  to: string
  vendorName: string
  eventName: string
  eventId: string
  categoryName: string
  expiresAt: Date
}): Promise<void> {
  const eventUrl = publicAppUrl(`/events/${params.eventId}`)
  const expiresLabel = params.expiresAt.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  await sendEmail({
    to: params.to,
    subject: `Priority booth invite — ${params.eventName}`,
    html: `
      <p>Hi ${params.vendorName},</p>
      <p>You have a <strong>24-hour priority window</strong> to claim a <strong>${params.categoryName}</strong> booth at <strong>${params.eventName}</strong>.</p>
      <p><a href="${eventUrl}">View event and apply</a></p>
      <p>This exclusive window ends ${expiresLabel}. After that, remaining spots open to all vendors on Popup Hub.</p>
    `,
    text: `Priority booth invite for ${params.eventName} (${params.categoryName}). Apply: ${eventUrl}. Window ends ${expiresLabel}.`,
  })
}
