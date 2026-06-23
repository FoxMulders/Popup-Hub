import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationType } from '@/types/database'
import {
  formatPaymentDueAtDisplay,
  paymentDueCountdownLabel,
} from '@/lib/applications/payment-deadline'
import { sendPaymentDueReminderEmail, type PaymentReminderStage } from '@/lib/email/payment-due-reminder'
import { sendPaymentExpiredEmail } from '@/lib/email/payment-expired'
import { dispatchNativePushToUsers } from '@/lib/mobile/push-dispatch'
import { sendSms } from '@/lib/twilio'
import { publicAppUrl } from '@/lib/url/public-app-url'

export type PaymentChaseKind = 'reminder' | 'expired'

export type NotifyVendorPaymentChaseParams = {
  supabase: SupabaseClient
  vendorId: string
  vendorEmail: string | null | undefined
  vendorName: string
  vendorPhone?: string | null
  applicationId: string
  eventId: string
  eventName: string
  paymentDueAt?: string | null
  amountCents?: number | null
  kind: PaymentChaseKind
  /** Reminder tier 1–3; required when kind is reminder. */
  reminderStage?: PaymentReminderStage
}

function buildInAppMessage(params: NotifyVendorPaymentChaseParams): {
  type: NotificationType
  message: string
} {
  const eventLabel = params.eventName?.trim() || 'your market'
  const payUrl = publicAppUrl('/vendor/applications')

  if (params.kind === 'expired') {
    return {
      type: 'payment_expired',
      message: `Your booth for "${eventLabel}" was released — payment was not received before the deadline. View applications: ${payUrl}`,
    }
  }

  const stage = params.reminderStage ?? 1
  const dueLabel = params.paymentDueAt
    ? `${paymentDueCountdownLabel(params.paymentDueAt)} (by ${formatPaymentDueAtDisplay(params.paymentDueAt)})`
    : 'soon'

  if (stage >= 3) {
    return {
      type: 'payment_due_reminder',
      message: `⏰ Final notice: pay for "${eventLabel}" ${dueLabel} or your booth will be released. Pay now: ${payUrl}`,
    }
  }

  if (stage >= 2) {
    return {
      type: 'payment_due_reminder',
      message: `Payment due soon for "${eventLabel}" — ${dueLabel}. Complete checkout: ${payUrl}`,
    }
  }

  return {
    type: 'payment_due_reminder',
    message: `Reminder: complete your booth payment for "${eventLabel}" ${dueLabel}. Pay now: ${payUrl}`,
  }
}

function buildPushTitle(params: NotifyVendorPaymentChaseParams): string {
  if (params.kind === 'expired') return 'Booth released'
  if ((params.reminderStage ?? 1) >= 3) return 'Final payment notice'
  return 'Payment reminder'
}

/**
 * Reach the vendor on every available channel: in-app notification, email, SMS, and native push.
 */
export async function notifyVendorPaymentChase(
  params: NotifyVendorPaymentChaseParams
): Promise<{ inApp: boolean; email: boolean; sms: boolean }> {
  const { type, message } = buildInAppMessage(params)
  const result = { inApp: false, email: false, sms: false }

  const { error } = await params.supabase.from('notifications').insert({
    user_id: params.vendorId,
    type,
    message,
    metadata: {
      application_id: params.applicationId,
      event_id: params.eventId,
      payment_due_at: params.paymentDueAt ?? null,
      reminder_stage: params.reminderStage ?? null,
      chase_kind: params.kind,
    },
  })

  if (!error) {
    result.inApp = true
  } else {
    console.error('[notify-vendor-payment-chase] in-app insert failed:', error)
  }

  void dispatchNativePushToUsers(params.supabase, {
    userIds: [params.vendorId],
    title: buildPushTitle(params),
    body: message.length > 180 ? `${message.slice(0, 177)}…` : message,
    deepLink: '/vendor/applications',
  }).catch((err) => {
    console.error('[notify-vendor-payment-chase] native push failed:', err)
  })

  const vendorEmail = params.vendorEmail?.trim()
  if (vendorEmail) {
    try {
      if (params.kind === 'expired') {
        const emailResult = await sendPaymentExpiredEmail({
          vendorEmail,
          vendorName: params.vendorName,
          marketName: params.eventName,
          applicationId: params.applicationId,
        })
        result.email = emailResult.ok
      } else if (params.paymentDueAt) {
        const emailResult = await sendPaymentDueReminderEmail({
          vendorEmail,
          vendorName: params.vendorName,
          marketName: params.eventName,
          paymentDueAt: params.paymentDueAt,
          amountCents: params.amountCents,
          stage: params.reminderStage ?? 1,
          applicationId: params.applicationId,
        })
        result.email = emailResult.ok
      }
    } catch (err) {
      console.error('[notify-vendor-payment-chase] email failed:', err)
    }
  }

  if (params.vendorPhone?.trim()) {
    try {
      await sendSms(params.vendorPhone.trim(), message)
      result.sms = true
    } catch (err) {
      console.error('[notify-vendor-payment-chase] SMS failed:', err)
    }
  }

  return result
}

export async function notifyCoordinatorPaymentReleased(params: {
  supabase: SupabaseClient
  coordinatorId: string
  vendorName: string
  eventName: string
  applicationId: string
  eventId: string
}): Promise<void> {
  const message = `${params.vendorName}'s booth for "${params.eventName}" was auto-released — payment deadline passed without payment.`

  await params.supabase.from('notifications').insert({
    user_id: params.coordinatorId,
    type: 'payment_overdue_released',
    message,
    metadata: {
      application_id: params.applicationId,
      event_id: params.eventId,
    },
  })
}
