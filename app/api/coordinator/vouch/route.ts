import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { vendorVouchForCoordinator } from '@/lib/coordinator/vouch'

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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'vendor') {
    return NextResponse.json({ error: 'Vendor account required' }, { status: 403 })
  }

  const body = (await request.json()) as { coordinatorId?: string }
  const coordinatorId = body.coordinatorId?.trim()

  if (!coordinatorId) {
    return NextResponse.json({ error: 'coordinatorId is required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const result = await vendorVouchForCoordinator(service, {
    vendorId: user.id,
    coordinatorId,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    vouchCount: result.vouchCount,
    coordinatorVerified: result.coordinatorVerified,
  })
}
