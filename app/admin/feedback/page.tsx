import { resolveAdminDb } from '@/lib/auth/require-admin'
import { FeedbackAdminDashboard } from '@/components/admin/feedback-admin-dashboard'
import type { FeatureRequest } from '@/types/database'

export const metadata = {
  title: 'Feature Requests | Admin',
}

export default async function AdminFeedbackPage() {
  const adminContext = await resolveAdminDb()
  if (!adminContext.ok) {
    return null
  }

  const { data, error } = await adminContext.db
    .from('feature_requests')
    .select(
      'id, user_id, session_role, submitter_role, title, target_component, problem, dream_solution, impact_level, screenshot_url, page_path, status, developer_notes, created_at, updated_at'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="market-panel p-6">
        <p className="text-sm text-destructive">Could not load feature requests: {error.message}</p>
      </div>
    )
  }

  return <FeedbackAdminDashboard initialRequests={(data ?? []) as FeatureRequest[]} />
}
