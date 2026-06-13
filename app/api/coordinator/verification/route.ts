import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import {
  COORDINATOR_FRAUD_PROFILE_SELECT,
  coordinatorHasPaymentTrustPath,
  coordinatorPaymentCollectionBlockReason,
  coordinatorPublishBlockReason,
  evaluateCoordinatorVerification,
  hasVerifiedBusinessTaxId,
  isSquareConnectedCoordinator,
} from '@/lib/coordinator/verification'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: roleProfile } = await supabase
    .from('profiles')
    .select(`role, is_admin, ${COORDINATOR_FRAUD_PROFILE_SELECT}`)
    .eq('id', user.id)
    .single()

  if (!roleProfile || !canActAsCoordinator(roleProfile)) {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const profile = roleProfile

  const { data: squareEvent } = await supabase
    .from('events')
    .select('id')
    .eq('coordinator_id', user.id)
    .not('square_merchant_id', 'is', null)
    .limit(1)
    .maybeSingle()

  const gate = {
    ...profile,
    has_square_event: !!squareEvent,
  }

  return NextResponse.json({
    verificationStatus: profile?.coordinator_verification_status ?? 'unverified',
    organizationName: profile?.coordinator_organization_name ?? null,
    businessNumber: profile?.coordinator_business_number ?? null,
    riskScore: profile?.coordinator_risk_score ?? 0,
    accountStatus: profile?.coordinator_account_status ?? 'active',
    publishBlockReason: coordinatorPublishBlockReason(gate),
    paymentCollectionBlockReason: coordinatorPaymentCollectionBlockReason(gate),
    canPublish: coordinatorPublishBlockReason(gate) === null,
    canCollectPayments: coordinatorPaymentCollectionBlockReason(gate) === null,
    squareConnected: isSquareConnectedCoordinator(gate),
    stripeConnected: profile?.stripe_onboarding_complete === true,
    paymentTrustComplete: coordinatorHasPaymentTrustPath(gate),
    hasVerifiedBusinessTaxId: hasVerifiedBusinessTaxId(gate),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(`role, is_admin, ${COORDINATOR_FRAUD_PROFILE_SELECT}`)
    .eq('id', user.id)
    .single()

  if (!profile || !canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const body = (await request.json()) as {
    organizationName?: string
  }

  const organizationName = body.organizationName?.trim()

  if (!organizationName) {
    return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 })
  }

  const evaluated = await evaluateCoordinatorVerification({
    coordinator_organization_name: organizationName,
    coordinator_business_number: null,
    coordinator_verification_status: profile.coordinator_verification_status,
  })

  const { error } = await supabase
    .from('profiles')
    .update({
      coordinator_organization_name: evaluated.coordinator_organization_name,
      coordinator_business_number: evaluated.coordinator_business_number,
      coordinator_risk_score: evaluated.coordinator_risk_score,
      coordinator_verification_status: evaluated.coordinator_verification_status,
    })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const message =
    evaluated.coordinator_verification_status === 'verified'
      ? 'Organizer verification complete — you can collect offline payments after approval.'
      : 'Organization details saved. Connect Square or Stripe to publish and collect card payments.'

  return NextResponse.json({
    ok: true,
    verificationStatus: evaluated.coordinator_verification_status,
    riskScore: evaluated.coordinator_risk_score,
    message,
  })
}
