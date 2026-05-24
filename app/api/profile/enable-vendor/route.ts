import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
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

  if (profile?.role === 'vendor' || profile?.role === 'coordinator') {
    return NextResponse.json(
      {
        error:
          profile.role === 'coordinator'
            ? 'Your account already includes vendor portal access.'
            : 'Vendor access is already enabled on this account.',
      },
      { status: 409 },
    )
  }

  if (profile?.role !== 'shopper') {
    return NextResponse.json({ error: 'Could not enable vendor access' }, { status: 409 })
  }

  const { error } = await supabase.rpc('apply_signup_role', { p_role: 'vendor' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: updated } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (updated?.role !== 'vendor') {
    return NextResponse.json({ error: 'Could not enable vendor access' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, role: updated.role })
}
