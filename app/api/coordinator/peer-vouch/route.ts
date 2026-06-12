import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { coordinatorPeerVouchForCoordinator } from '@/lib/coordinator/vouch'

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
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Organizer account required' }, { status: 403 })
  }

  const body = (await request.json()) as { coordinatorId?: string }
  const coordinatorId = body.coordinatorId?.trim()

  if (!coordinatorId) {
    return NextResponse.json({ error: 'coordinatorId is required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const result = await coordinatorPeerVouchForCoordinator(service, {
    voucherCoordinatorId: user.id,
    targetCoordinatorId: coordinatorId,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    vendorVouchCount: result.vendorVouchCount,
    coordinatorVouchCount: result.coordinatorVouchCount,
    vouchCount: result.vendorVouchCount,
    coordinatorVerified: result.coordinatorVerified,
  })
}
