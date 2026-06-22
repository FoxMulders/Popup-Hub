import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyAdminsOfVenueSubmission } from '@/lib/venues/notify-admins-venue-submission'

/** Coordinator callback after a new platform venue submission row is created. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { submissionId?: string }
  const submissionId = body.submissionId?.trim()
  if (!submissionId) {
    return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
  }

  const { data: submission } = await supabase
    .from('platform_venue_submissions')
    .select('id, location_name, address, submitted_by')
    .eq('id', submissionId)
    .maybeSingle()

  if (!submission || submission.submitted_by !== user.id) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  const { data: submitter } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const service = await createServiceClient()
  await notifyAdminsOfVenueSubmission(service, {
    submissionId: submission.id,
    locationName: submission.location_name,
    address: submission.address,
    submitterName: submitter?.full_name ?? null,
  })

  return NextResponse.json({ ok: true })
}
