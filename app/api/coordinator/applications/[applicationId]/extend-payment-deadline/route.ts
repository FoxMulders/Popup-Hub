import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { isApplicationAwaitingBoothPayment } from '@/lib/applications/payment-fields'
import {
  buildAuditStateFromUpdates,
  extractClientIp,
  mutateApplicationWithSecurityAudit,
  SECURITY_AUDIT_ACTION,
  snapshotApplicationAuditState,
} from '@/lib/audit/security-audit-log'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_HOURS = new Set([24, 48])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> }
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
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { hours?: number }
  const hours = body.hours
  if (!hours || !ALLOWED_HOURS.has(hours)) {
    return NextResponse.json({ error: 'hours must be 24 or 48' }, { status: 400 })
  }

  const { data: application } = await supabase
    .from('booth_applications')
    .select(`
      id,
      vendor_id,
      event_id,
      status,
      payment_status,
      payment_method,
      application_payment_status,
      payment_due_at,
      event:events(id, coordinator_id)
    `)
    .eq('id', applicationId)
    .single()

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const eventRow = Array.isArray(application.event) ? application.event[0] : application.event
  if (!eventRow || eventRow.coordinator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isApplicationAwaitingBoothPayment(application)) {
    return NextResponse.json({ error: 'Application is not awaiting payment' }, { status: 409 })
  }

  const baseMs = application.payment_due_at
    ? new Date(application.payment_due_at).getTime()
    : Date.now()
  const paymentDueAt = new Date(baseMs + hours * 60 * 60 * 1000).toISOString()

  const previousState = snapshotApplicationAuditState(application)
  const updates = {
    payment_due_at: paymentDueAt,
    payment_reminder_stage: 0,
    last_payment_reminder_at: null,
  }
  const newState = buildAuditStateFromUpdates(previousState, updates)

  const mutation = await mutateApplicationWithSecurityAudit(supabase, {
    applicationId,
    actorId: user.id,
    targetVendorId: application.vendor_id,
    actionType: SECURITY_AUDIT_ACTION.PAYMENT_DEADLINE_EXTENDED,
    previousState,
    newState,
    updates,
    ipAddress: extractClientIp(request),
  })

  if (!mutation.ok) {
    return NextResponse.json({ error: mutation.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    payment_due_at: mutation.application?.payment_due_at ?? paymentDueAt,
  })
}
