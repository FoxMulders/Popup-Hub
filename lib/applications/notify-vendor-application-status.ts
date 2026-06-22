import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ApplicationPaymentStatus,
  ApplicationStatus,
  NotificationType,
  PaymentStatus,
} from '@/types/database'
import { sendSms } from '@/lib/twilio'

export type NotifyVendorApplicationStatusParams = {
  supabase: SupabaseClient
  vendorId: string
  applicationId: string
  eventId: string
  eventName?: string | null
  status: ApplicationStatus
  declineMessage?: string | null
  paymentStatus?: PaymentStatus | null
  applicationPaymentStatus?: ApplicationPaymentStatus | null
  /** When false, skips Twilio SMS (in-app notification still sent). Default true. */
  sendSms?: boolean
}

const NOTIFY_STATUSES = new Set<ApplicationStatus>([
  'approved',
  'pending_insurance',
  'rejected',
  'waitlisted',
])

function resolveNotificationType(status: ApplicationStatus): NotificationType | null {
  switch (status) {
    case 'approved':
    case 'pending_insurance':
      return 'application_approved'
    case 'rejected':
      return 'application_rejected'
    case 'waitlisted':
      return 'waitlist_triggered'
    default:
      return null
  }
}

function buildVendorApplicationStatusMessage(
  params: NotifyVendorApplicationStatusParams
): string | null {
  const eventLabel = params.eventName?.trim() || 'the event'

  switch (params.status) {
    case 'approved':
      if (params.paymentStatus === 'payment_required') {
        return `✅ Your booth application for "${eventLabel}" has been approved! Complete your payment to secure your spot.`
      }
      if (params.applicationPaymentStatus === 'PENDING_REVIEW') {
        return `✅ Your booth application for "${eventLabel}" has been approved! Send your e-transfer — the coordinator will confirm payment.`
      }
      return `✅ Your booth application for "${eventLabel}" has been approved! See you at the event.`
    case 'pending_insurance':
      return `✅ Your booth application for "${eventLabel}" has been approved! Upload your market insurance proof to finalize your spot.`
    case 'rejected':
      if (params.declineMessage?.trim()) {
        return params.declineMessage.trim()
      }
      return `Your booth application for "${eventLabel}" was not selected this time. Keep an eye out for future events!`
    case 'waitlisted':
      return `Your application for "${eventLabel}" has been waitlisted. We'll notify you if a spot opens up.`
    default:
      return null
  }
}

export function shouldNotifyVendorApplicationStatus(status: ApplicationStatus): boolean {
  return NOTIFY_STATUSES.has(status)
}

/** Insert in-app notification (+ optional SMS) when a vendor application status changes. */
export async function notifyVendorApplicationStatus(
  params: NotifyVendorApplicationStatusParams
): Promise<void> {
  if (!shouldNotifyVendorApplicationStatus(params.status)) return

  const type = resolveNotificationType(params.status)
  const message = buildVendorApplicationStatusMessage(params)
  if (!type || !message) return

  const { error } = await params.supabase.from('notifications').insert({
    user_id: params.vendorId,
    type,
    message,
    metadata: {
      application_id: params.applicationId,
      event_id: params.eventId,
      new_status: params.status,
      payment_required: params.paymentStatus === 'payment_required',
    },
  })

  if (error) {
    console.error('[notify-vendor-application-status] insert failed:', error)
    return
  }

  if (params.sendSms === false) return

  try {
    const { data: profile } = await params.supabase
      .from('profiles')
      .select('phone')
      .eq('id', params.vendorId)
      .single()

    if (profile?.phone) {
      await sendSms(profile.phone, message)
    }
  } catch (err) {
    console.error('[notify-vendor-application-status] SMS failed:', err)
  }
}

/** Short confirmation when insurance upload completes and booth is fully approved. */
export async function notifyVendorInsuranceApproved(params: {
  supabase: SupabaseClient
  vendorId: string
  applicationId: string
  eventId: string
  eventName?: string | null
  sendSms?: boolean
}): Promise<void> {
  const eventLabel = params.eventName?.trim() || 'the event'
  const message = `✅ Insurance received — your booth for "${eventLabel}" is fully approved! See you at the market.`

  const { error } = await params.supabase.from('notifications').insert({
    user_id: params.vendorId,
    type: 'application_approved',
    message,
    metadata: {
      application_id: params.applicationId,
      event_id: params.eventId,
      new_status: 'approved',
      insurance_cleared: true,
    },
  })

  if (error) {
    console.error('[notify-vendor-insurance-approved] insert failed:', error)
    return
  }

  if (params.sendSms === false) return

  try {
    const { data: profile } = await params.supabase
      .from('profiles')
      .select('phone')
      .eq('id', params.vendorId)
      .single()

    if (profile?.phone) {
      await sendSms(profile.phone, message)
    }
  } catch (err) {
    console.error('[notify-vendor-insurance-approved] SMS failed:', err)
  }
}
