import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveVendorDisplayName } from '@/lib/email/application-received'

const MAX_MESSAGE_LENGTH = 1000
const FOLLOW_UP_COOLDOWN_MS = 24 * 60 * 60 * 1000

const FOLLOW_UP_STATUSES = new Set(['pending', 'pending_insurance', 'waitlisted'])

export async function POST(
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

  const body = (await request.json()) as { message?: string }
  const message = body.message?.trim()

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` },
      { status: 400 },
    )
  }

  const { data: application } = await supabase
    .from('booth_applications')
    .select(`
      id,
      vendor_id,
      event_id,
      status,
      payment_status,
      application_payment_status,
      event:events(
        id,
        name,
        status,
        coordinator_id,
        coordinator:profiles!events_coordinator_id_fkey(id, full_name, email)
      )
    `)
    .eq('id', applicationId)
    .single()

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (application.vendor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!FOLLOW_UP_STATUSES.has(application.status)) {
    if (
      application.status !== 'approved' ||
      !(
        application.payment_status === 'payment_required' ||
        application.application_payment_status === 'PENDING_REVIEW'
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Follow-up is only available while your application is pending review, waitlisted, awaiting insurance proof, or approved with payment still due.',
        },
        { status: 409 },
      )
    }
  }

  const eventRow = Array.isArray(application.event) ? application.event[0] : application.event

  if (!eventRow || eventRow.status === 'cancelled') {
    return NextResponse.json({ error: 'This event is no longer active' }, { status: 409 })
  }

  const coordinatorId = eventRow.coordinator_id as string | undefined
  if (!coordinatorId) {
    return NextResponse.json({ error: 'Organizer not found' }, { status: 404 })
  }

  const service = await createServiceClient()
  const cooldownSince = new Date(Date.now() - FOLLOW_UP_COOLDOWN_MS).toISOString()

  const { data: recentFollowUp } = await service
    .from('notifications')
    .select('id')
    .eq('user_id', coordinatorId)
    .eq('type', 'application_follow_up')
    .gte('created_at', cooldownSince)
    .contains('metadata', { application_id: applicationId })
    .limit(1)
    .maybeSingle()

  if (recentFollowUp) {
    return NextResponse.json(
      { error: 'You already sent a follow-up for this application in the last 24 hours.' },
      { status: 429 },
    )
  }

  const [{ data: vendorProfile }, { data: passport }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('vendor_passports').select('business_name').eq('user_id', user.id).maybeSingle(),
  ])

  const vendorName = resolveVendorDisplayName(passport, vendorProfile)
  const eventName = eventRow.name ?? 'your market'
  const preview =
    message.length > 160 ? `${message.slice(0, 157)}…` : message

  const { error: notifyError } = await service.from('notifications').insert({
    user_id: coordinatorId,
    type: 'application_follow_up',
    message: `${vendorName} followed up on their application for "${eventName}": ${preview}`,
    metadata: {
      application_id: applicationId,
      event_id: application.event_id,
      vendor_id: user.id,
      follow_up_message: message,
    },
  })

  if (notifyError) {
    return NextResponse.json({ error: notifyError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
