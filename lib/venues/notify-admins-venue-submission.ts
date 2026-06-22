import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send'

interface NotifyAdminsVenueSubmissionParams {
  submissionId: string
  locationName: string
  address: string
  submitterName: string | null
}

export async function notifyAdminsOfVenueSubmission(
  service: SupabaseClient,
  params: NotifyAdminsVenueSubmissionParams
): Promise<void> {
  const { data: admins } = await service
    .from('profiles')
    .select('id, email')
    .eq('is_admin', true)

  if (!admins?.length) return

  const submitterLabel = params.submitterName?.trim() || 'A coordinator'
  const venueLabel = `${params.locationName.trim()} — ${params.address.trim()}`
  const message = `New venue submission from ${submitterLabel}: ${venueLabel}`
  const adminUrl = 'https://popuphub.ca/admin/venues'

  await service.from('notifications').insert(
    admins.map((admin) => ({
      user_id: admin.id,
      type: 'venue_submission_pending',
      message,
      metadata: {
        venue_submission_id: params.submissionId,
        location_name: params.locationName,
        address: params.address,
      },
    }))
  )

  const emailSubject = `[Popup Hub Admin] New venue submission: ${params.locationName.trim()}`
  const emailText = `${message}\n\nReview in the admin console:\n${adminUrl}`

  await Promise.all(
    admins
      .filter((admin) => admin.email?.trim())
      .map((admin) =>
        sendEmail({
          to: admin.email!.trim(),
          subject: emailSubject,
          text: emailText,
          html: `<p>${message}</p><p><a href="${adminUrl}">Review venue submissions</a></p>`,
        })
      )
  )
}
