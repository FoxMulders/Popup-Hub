import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { logSecurityEvent } from '@/lib/security/audit-log'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    vendorId?: string
    eventId?: string
  }

  const { vendorId, eventId } = body
  if (!vendorId || !eventId) {
    return NextResponse.json({ error: 'vendorId and eventId are required' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('coordinator_id', user.id)
    .maybeSingle()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const { data: application } = await supabase
    .from('booth_applications')
    .select('id')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .maybeSingle()

  if (!application) {
    return NextResponse.json(
      { error: 'Vendor has no application for this event' },
      { status: 404 }
    )
  }

  const { data: passport, error } = await supabase
    .from('vendor_passports')
    .update({
      is_verified: true,
      verification_status: 'verified',
      risk_score: 0,
    })
    .eq('user_id', vendorId)
    .select('id, is_verified, verification_status, risk_score')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!passport) {
    return NextResponse.json({ error: 'Vendor passport not found' }, { status: 404 })
  }

  await logSecurityEvent({
    eventType: 'vendor_verification_override',
    actorId: user.id,
    vendorId,
    eventId,
    applicationId: application.id,
    metadata: { verification_status: 'verified' },
  })

  return NextResponse.json({ ok: true, passport })
}
