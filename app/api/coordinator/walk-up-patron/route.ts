import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createWalkUpPatron } from '@/lib/coordinator/create-walk-up-patron'

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

  if (profile?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { fullName?: string; email?: string | null }
  const admin = createAdminClient()
  const result = await createWalkUpPatron(admin, {
    fullName: body.fullName ?? '',
    email: body.email,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    patron: {
      id: result.userId,
      full_name: result.fullName,
      email: result.email,
      walletNumber: result.walletNumber,
    },
  })
}
