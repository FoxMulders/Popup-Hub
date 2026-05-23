import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { id: requestId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    action?: 'approve' | 'reject'
    rejection_reason?: string | null
  }
  const { action, rejection_reason } = body
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: accessRequest } = await supabase
    .from('vendor_access_requests')
    .select('*, shopper:profiles!vendor_access_requests_shopper_id_fkey(full_name, email)')
    .eq('id', requestId)
    .eq('coordinator_id', user.id)
    .eq('status', 'pending')
    .single()

  if (!accessRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const service = await createServiceClient()

  if (action === 'reject') {
    await supabase
      .from('vendor_access_requests')
      .update({
        status: 'rejected',
        rejection_reason: rejection_reason ?? null,
        reviewed_at: now,
      })
      .eq('id', requestId)

    await service.from('notifications').insert({
      user_id: accessRequest.shopper_id,
      type: 'vendor_access_rejected',
      message: 'Your vendor access request was not approved at this time.',
      metadata: { coordinator_id: user.id, request_id: requestId },
    })

    return NextResponse.json({ ok: true })
  }

  const token = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  await supabase
    .from('vendor_access_requests')
    .update({ status: 'approved', reviewed_at: now })
    .eq('id', requestId)

  await supabase.from('coordinator_vendor_approvals').upsert(
    {
      coordinator_id: user.id,
      vendor_user_id: accessRequest.shopper_id,
      request_id: requestId,
      approved_at: now,
    },
    { onConflict: 'coordinator_id,vendor_user_id' }
  )

  await service.from('vendor_invitations').insert({
    request_id: requestId,
    token,
    expires_at: expiresAt,
  })

  const { data: coordinatorProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const organizerName = coordinatorProfile?.full_name ?? 'A market organizer'
  const activateUrl = `/vendor/activate?token=${token}`

  await service.from('notifications').insert({
    user_id: accessRequest.shopper_id,
    type: 'vendor_access_approved',
    message: `${organizerName} approved your vendor access. Activate your vendor portal to apply for booths.`,
    metadata: {
      coordinator_id: user.id,
      request_id: requestId,
      activate_url: activateUrl,
      token,
    },
  })

  return NextResponse.json({ ok: true, activate_url: activateUrl })
}
