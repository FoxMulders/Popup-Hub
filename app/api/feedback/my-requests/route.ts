import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserFeatureRequest } from '@/types/database'

const USER_FEATURE_REQUEST_COLUMNS =
  'id, title, status, resolution_notes, problem, dream_solution, impact_level, target_component, submitter_role, screenshot_url, page_path, created_at, updated_at, resolved_at, reopened_at'

/**
 * GET /api/feedback/my-requests
 * Lists the authenticated user's feature requests (excludes developer_notes).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('feature_requests')
    .select(USER_FEATURE_REQUEST_COLUMNS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requests: (data ?? []) as UserFeatureRequest[] })
}
