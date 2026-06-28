import { redirect } from 'next/navigation'
import { resolveAdminDb } from '@/lib/auth/require-admin'
import { accessDeniedRedirect } from '@/lib/auth/rbac'
import { FeedbackAdminDashboard } from '@/components/admin/feedback-admin-dashboard'
import { createClient } from '@/lib/supabase/server'
import type { FeatureRequest } from '@/types/database'

export const metadata = {
  title: 'Feature Requests | Admin',
}

export default async function AdminFeedbackPage() {
  const adminContext = await resolveAdminDb()
  if (!adminContext.ok) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase.from('profiles').select('role').eq('id', user.id).single()
      : { data: null }
    redirect(accessDeniedRedirect(profile?.role))
  }

  const { data, error } = await adminContext.db
    .from('feature_requests')
    .select(
      'id, user_id, session_role, submitter_role, title, target_component, problem, dream_solution, impact_level, screenshot_url, page_path, status, developer_notes, resolution_notes, resolved_at, reopened_at, created_at, updated_at'
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
