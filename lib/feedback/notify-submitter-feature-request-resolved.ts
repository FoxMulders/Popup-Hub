import type { SupabaseClient } from '@supabase/supabase-js'
import type { FeatureRequestStatus } from '@/types/database'

interface NotifySubmitterFeatureRequestResolvedParams {
  userId: string
  featureRequestId: string
  title: string
  status: FeatureRequestStatus
  resolutionNotes: string | null
}

export async function notifySubmitterFeatureRequestResolved(
  service: SupabaseClient,
  params: NotifySubmitterFeatureRequestResolvedParams
): Promise<void> {
  const titlePreview =
    params.title.length > 80 ? `${params.title.slice(0, 77)}…` : params.title

  const statusLabel = params.status === 'completed' ? 'completed' : 'declined'
  const notesPreview = params.resolutionNotes?.trim()
    ? params.resolutionNotes.trim().length > 120
      ? `${params.resolutionNotes.trim().slice(0, 117)}…`
      : params.resolutionNotes.trim()
    : null

  const message = notesPreview
    ? `Your feature request "${titlePreview}" was marked ${statusLabel}: ${notesPreview}`
    : `Your feature request "${titlePreview}" was marked ${statusLabel}. View details in My Suggestions.`

  await service.from('notifications').insert({
    user_id: params.userId,
    type: 'feature_request_resolved',
    message,
    metadata: {
      feature_request_id: params.featureRequestId,
      title: params.title,
      status: params.status,
      resolution_notes: params.resolutionNotes,
    },
  })
}
