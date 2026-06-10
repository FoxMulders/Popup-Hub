import { NextResponse } from 'next/server'
import { resolveAdminDb } from '@/lib/auth/require-admin'
import type { CoordinatorAccountStatus, CoordinatorVerificationStatus } from '@/types/database'

type AdminAction = 'approve' | 'reject' | 'suspend' | 'reinstate' | 'ban'

export async function POST(request: Request) {
  const adminCtx = await resolveAdminDb(request)
  if (!adminCtx.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    coordinatorId?: string
    action?: AdminAction
    note?: string
  }

  const { coordinatorId, action } = body
  if (!coordinatorId || !action) {
    return NextResponse.json({ error: 'coordinatorId and action are required' }, { status: 400 })
  }

  const { data: profile } = await adminCtx.db
    .from('profiles')
    .select('id, role, coordinator_verification_status, coordinator_account_status')
    .eq('id', coordinatorId)
    .single()

  if (!profile || profile.role !== 'coordinator') {
    return NextResponse.json({ error: 'Coordinator profile not found' }, { status: 404 })
  }

  const updates: {
    coordinator_verification_status?: CoordinatorVerificationStatus
    coordinator_account_status?: CoordinatorAccountStatus
    coordinator_risk_score?: number
  } = {}

  switch (action) {
    case 'approve':
      updates.coordinator_verification_status = 'verified'
      updates.coordinator_account_status = 'active'
      updates.coordinator_risk_score = 0
      break
    case 'reject':
      updates.coordinator_verification_status = 'rejected'
      break
    case 'suspend':
      updates.coordinator_account_status = 'suspended'
      break
    case 'reinstate':
      updates.coordinator_account_status = 'active'
      break
    case 'ban':
      updates.coordinator_account_status = 'banned'
      updates.coordinator_verification_status = 'rejected'
      break
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { error } = await adminCtx.db.from('profiles').update(updates).eq('id', coordinatorId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    coordinatorId,
    action,
    verificationStatus: updates.coordinator_verification_status ?? profile.coordinator_verification_status,
    accountStatus: updates.coordinator_account_status ?? profile.coordinator_account_status,
  })
}
