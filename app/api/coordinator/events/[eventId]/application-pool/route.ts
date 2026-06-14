import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { partitionDashboardApplicationSnapshots } from '@/lib/coordinator/dashboard-application-snapshots'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
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
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const scope = await getCoordinatorScope(supabase, user.id)

  const { data: event, error: eventError } = await applyCoordinatorEventScope(
    supabase.from('events').select('id').eq('id', eventId),
    user.id,
    scope.isAdmin
  ).maybeSingle()

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const { data: applications, error: applicationsError } = await supabase
    .from('booth_applications')
    .select(
      `
      id,
      event_id,
      vendor_id,
      status,
      payment_status,
      payment_method,
      application_payment_status,
      booth_number,
      table_count,
      vendor:profiles!booth_applications_vendor_id_fkey(full_name),
      category:categories(name)
    `
    )
    .eq('event_id', eventId)
    .order('applied_at', { ascending: true })

  if (applicationsError) {
    return NextResponse.json({ error: applicationsError.message }, { status: 500 })
  }

  const { approved, pending } = partitionDashboardApplicationSnapshots(applications ?? [])

  return NextResponse.json({ approved, pending })
}
