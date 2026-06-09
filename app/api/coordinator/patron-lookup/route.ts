import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { lookupPatrons } from '@/lib/coordinator/patron-lookup'

export async function GET(request: Request) {
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

  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const eventId = url.searchParams.get('eventId')

  if (q.trim().length < 2) {
    return NextResponse.json({ patrons: [] })
  }

  const admin = createAdminClient()
  const patrons = await lookupPatrons(admin, q, eventId)

  return NextResponse.json({ patrons })
}
