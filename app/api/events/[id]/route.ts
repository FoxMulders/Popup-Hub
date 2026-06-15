import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { deleteDraftEvent } from '@/lib/events/delete-draft-event'
import { COORDINATOR_STUDIO_PATH } from '@/lib/coordinator/coordinator-routes'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/events/[id]
 * Coordinator-only: permanently removes a draft market (no vendor applications).
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id: eventId } = await context.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await deleteDraftEvent(supabase, {
    eventId,
    coordinatorId: user.id,
    isAdmin: profile?.is_admin === true,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  revalidatePath(COORDINATOR_STUDIO_PATH)
  revalidatePath('/coordinator/dashboard')
  revalidatePath('/coordinator/events/new')

  return NextResponse.json({ ok: true })
}
