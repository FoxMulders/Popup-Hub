import type { SupabaseClient } from '@supabase/supabase-js'
import type { FeatureImpactLevel, FeatureSubmitterRole } from '@/lib/feedback/feature-request-config'

interface NotifyAdminsFeatureRequestParams {
  featureRequestId: string
  title: string
  submitterRole: FeatureSubmitterRole
  impactLevel: FeatureImpactLevel
  reporterId: string
  reporterName: string | null
}

export async function notifyAdminsOfFeatureRequest(
  service: SupabaseClient,
  params: NotifyAdminsFeatureRequestParams
): Promise<void> {
  const { data: admins } = await service.from('profiles').select('id').eq('is_admin', true)

  if (!admins?.length) return

  const roleLabel =
    params.submitterRole === 'coordinator'
      ? 'coordinator'
      : params.submitterRole === 'vendor'
        ? 'vendor'
        : 'patron'

  const reporterLabel = params.reporterName?.trim() || 'A user'
  const titlePreview =
    params.title.length > 80 ? `${params.title.slice(0, 77)}…` : params.title

  const urgencyPrefix =
    params.impactLevel === 'critical'
      ? 'Critical feature request'
      : params.impactLevel === 'workflow_blocked'
        ? 'Blocked-workflow feature request'
        : 'New feature request'

  const message = `${urgencyPrefix} from ${reporterLabel} (${roleLabel}): "${titlePreview}"`

  await service.from('notifications').insert(
    admins.map((admin) => ({
      user_id: admin.id,
      type: 'feature_request_submitted',
      message,
      metadata: {
        feature_request_id: params.featureRequestId,
        title: params.title,
        submitter_role: params.submitterRole,
        impact_level: params.impactLevel,
        reporter_id: params.reporterId,
      },
    }))
  )
}
