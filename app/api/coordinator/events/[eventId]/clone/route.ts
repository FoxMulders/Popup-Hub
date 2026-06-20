import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { cloneCoordinatorEvent } from '@/lib/coordinator/clone-event'
import { createAdminClient, createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ eventId: string }> }

export async function POST(_request: Request, { params }: Params) {
  const { eventId } = await params
  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to clone this market' }, { status: 401 })
  }

  const { data: profile } = await authSupabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const admin = createAdminClient()
  const result = await cloneCoordinatorEvent(admin, eventId, user.id)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    eventId: result.eventId,
    nextPath: `/coordinator/events/${result.eventId}/setup?step=1`,
  })
}
