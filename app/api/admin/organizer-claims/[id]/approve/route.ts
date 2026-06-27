import { NextResponse } from 'next/server'
import { hasAdminAccess } from '@/lib/auth/require-admin'
import { approveOrganizerClaimRequest } from '@/lib/organizers/claim-organizer'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  if (!(await hasAdminAccess())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await approveOrganizerClaimRequest(id, user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true })
}
