import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  computeVendorPlatformHistory,
  type VendorHistoryApplication,
} from '@/lib/applications/vendor-review-stats'

async function assertCoordinatorOwnsApplication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  userId: string,
) {
  const { data: application } = await supabase
    .from('booth_applications')
    .select(`
      id,
      vendor_id,
      coordinator_review_notes,
      event:events(id, coordinator_id)
    `)
    .eq('id', applicationId)
    .single()

  if (!application) {
    return { error: NextResponse.json({ error: 'Application not found' }, { status: 404 }) }
  }

  const eventRow = Array.isArray(application.event) ? application.event[0] : application.event
  if (!eventRow || eventRow.coordinator_id !== userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { application }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const { applicationId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ownership = await assertCoordinatorOwnsApplication(supabase, applicationId, user.id)
  if ('error' in ownership && ownership.error) return ownership.error

  const vendorId = ownership.application!.vendor_id

  const { data: historyRows, error: historyError } = await supabase
    .from('booth_applications')
    .select(`
      id,
      status,
      checked_in,
      event_id,
      event:events(start_at, end_at, status)
    `)
    .eq('vendor_id', vendorId)
    .order('applied_at', { ascending: false })

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 })
  }

  const history = computeVendorPlatformHistory(
    (historyRows ?? []) as VendorHistoryApplication[],
    applicationId,
  )

  return NextResponse.json({
    history,
    coordinatorReviewNotes: ownership.application!.coordinator_review_notes ?? '',
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const { applicationId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ownership = await assertCoordinatorOwnsApplication(supabase, applicationId, user.id)
  if ('error' in ownership && ownership.error) return ownership.error

  const body = (await request.json()) as { coordinatorReviewNotes?: string }
  const notes = body.coordinatorReviewNotes?.trim() ?? ''

  const { data: updated, error } = await supabase
    .from('booth_applications')
    .update({ coordinator_review_notes: notes || null })
    .eq('id', applicationId)
    .select('coordinator_review_notes')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    coordinatorReviewNotes: updated.coordinator_review_notes ?? '',
  })
}
