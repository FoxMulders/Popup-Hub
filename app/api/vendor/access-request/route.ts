import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canRequestVendorAccess } from '@/lib/auth/rbac'
import type { Role } from '@/types/database'

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

  const role = (profile?.role as Role | undefined) ?? 'shopper'
  if (!canRequestVendorAccess(role)) {
    return NextResponse.json(
      { error: 'Vendor access requests require a vendor account' },
      { status: 403 }
    )
  }

  const body = (await request.json()) as { coordinator_id?: string; message?: string | null }
  const { coordinator_id, message } = body
  if (!coordinator_id) {
    return NextResponse.json({ error: 'coordinator_id required' }, { status: 400 })
  }

  const { data: coordinator } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', coordinator_id)
    .eq('role', 'coordinator')
    .single()

  if (!coordinator) {
    return NextResponse.json({ error: 'Organizer not found' }, { status: 404 })
  }

  const { data: existingPending } = await supabase
    .from('vendor_access_requests')
    .select('id')
    .eq('shopper_id', user.id)
    .eq('coordinator_id', coordinator_id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingPending) {
    return NextResponse.json({ error: 'You already have a pending request' }, { status: 409 })
  }

  const { data: alreadyApproved } = await supabase
    .from('coordinator_vendor_approvals')
    .select('id')
    .eq('vendor_user_id', user.id)
    .eq('coordinator_id', coordinator_id)
    .maybeSingle()

  if (alreadyApproved) {
    return NextResponse.json({ error: 'You are already approved for this organizer' }, { status: 409 })
  }

  const { error } = await supabase.from('vendor_access_requests').insert({
    shopper_id: user.id,
    coordinator_id,
    message: message ?? null,
    status: 'pending',
  })

  if (error) {
    return NextResponse.json({ error: 'Could not create request' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
