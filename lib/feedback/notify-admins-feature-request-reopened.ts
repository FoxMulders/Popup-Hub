import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send'

interface NotifyAdminsFeatureRequestReopenedParams {
  featureRequestId: string
  title: string
  reporterName: string | null
  reopenReason?: string | null
}

export async function notifyAdminsOfFeatureRequestReopened(
  service: SupabaseClient,
  params: NotifyAdminsFeatureRequestReopenedParams
): Promise<void> {
  const { data: admins } = await service
    .from('profiles')
    .select('id, email, full_name')
    .eq('is_admin', true)

  if (!admins?.length) return

  const reporterLabel = params.reporterName?.trim() || 'A user'
  const titlePreview =
    params.title.length > 80 ? `${params.title.slice(0, 77)}…` : params.title

  const reasonSuffix = params.reopenReason?.trim()
    ? ` Reason: "${params.reopenReason.trim().length > 100 ? `${params.reopenReason.trim().slice(0, 97)}…` : params.reopenReason.trim()}"`
    : ''

  const message = `${reporterLabel} reopened a completed feature request: "${titlePreview}".${reasonSuffix}`
  const adminUrl = 'https://popuphub.ca/admin/feedback'

  await service.from('notifications').insert(
    admins.map((admin) => ({
      user_id: admin.id,
      type: 'feature_request_reopened',
      message,
      metadata: {
        feature_request_id: params.featureRequestId,
        title: params.title,
      },
    }))
  )

  const emailSubject = `[Popup Hub Admin] Feature request reopened: ${titlePreview}`
  const emailText = `${message}\n\nReview in the admin console:\n${adminUrl}`

  await Promise.all(
    admins
      .filter((admin) => admin.email?.trim())
      .map((admin) =>
        sendEmail({
          to: admin.email!.trim(),
          subject: emailSubject,
          text: emailText,
          html: `<p>${message}</p><p><a href="${adminUrl}">Open admin console</a></p>`,
        })
      )
  )
}
