import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { createClient } from '@/lib/supabase/server'
import {
  applyEarlyExitReliability,
  applyLateLoadInReliability,
  createVendorReliabilityAdminClient,
} from '@/lib/coordinator/vendor-reliability-ops'

type ReliabilityKind = 'late_load_in' | 'early_exit'

export async function POST(
  request: Request,
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

  const body = (await request.json()) as {
    vendorId?: string
    applicationId?: string
    kind?: ReliabilityKind
  }

  const kind = body.kind
  const applicationId = String(body.applicationId ?? '')
  let vendorId = body.vendorId

  if (!kind || (kind !== 'late_load_in' && kind !== 'early_exit')) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  }

  if (!vendorId && applicationId) {
    const { data: application } = await supabase
      .from('booth_applications')
      .select('vendor_id')
      .eq('id', applicationId)
      .eq('event_id', eventId)
      .maybeSingle()
    vendorId = application?.vendor_id ?? undefined
  }

  if (!vendorId) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }

  const admin = createVendorReliabilityAdminClient()
  const applied =
    kind === 'late_load_in'
      ? await applyLateLoadInReliability(admin, vendorId)
      : await applyEarlyExitReliability(admin, vendorId)

  if (!applied) {
    return NextResponse.json({ error: 'Failed to update vendor reliability' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
