import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildPassportScanQrValue,
  generateSignedPassportToken,
  isPassportQrEligible,
} from '@/lib/passport/passport-token'
import { logSecurityEvent } from '@/lib/security/audit-log'
import { isVendorAccountBlocked } from '@/lib/vendor/verification'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }

  const [{ data: passport }, { data: application }] = await Promise.all([
    supabase
      .from('vendor_passports')
      .select(
        'account_status, risk_score, verification_status, business_number, social_handle'
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('booth_applications')
      .select(
        'id, event_id, vendor_id, status, payment_status, payment_method, application_payment_status, approved_at'
      )
      .eq('event_id', eventId)
      .eq('vendor_id', user.id)
      .maybeSingle(),
  ])

  if (isVendorAccountBlocked(passport)) {
    await logSecurityEvent({
      eventType: 'passport_qr_blocked',
      actorId: user.id,
      vendorId: user.id,
      eventId,
      metadata: { reason: 'account_suspended' },
    })
    return NextResponse.json(
      { error: 'Passport QR unavailable while account is suspended.' },
      { status: 403 }
    )
  }

  if (!application || !isPassportQrEligible(application)) {
    await logSecurityEvent({
      eventType: 'passport_qr_blocked',
      actorId: user.id,
      vendorId: user.id,
      eventId,
      applicationId: application?.id,
      metadata: {
        reason: 'not_paid_or_not_approved',
        status: application?.status,
        payment_status: application?.payment_status,
        application_payment_status: application?.application_payment_status,
      },
    })
    return NextResponse.json(
      {
        error:
          'Passport QR is available only after your application is approved and payment is completed.',
      },
      { status: 403 }
    )
  }

  try {
    const token = generateSignedPassportToken(application)
    return NextResponse.json({
      token,
      qrValue: buildPassportScanQrValue(token),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not generate passport QR'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
