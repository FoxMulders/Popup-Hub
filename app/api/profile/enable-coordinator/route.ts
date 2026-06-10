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

  if (profile?.role !== 'shopper') {
    return NextResponse.json(
      {
        error:
          profile?.role === 'coordinator'
            ? 'Organizer access is already enabled on this account.'
            : 'Vendor accounts must contact support to add organizer access.',
      },
      { status: 409 },
    )
  }

  const { error } = await supabase.rpc('apply_signup_role', { p_role: 'coordinator' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase
    .from('profiles')
    .update({ coordinator_verification_status: 'pending' })
    .eq('id', user.id)

  const { data: updated } = await supabase
    .from('profiles')
    .select('role, coordinator_verification_status')
    .eq('id', user.id)
    .single()

  if (updated?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Could not enable organizer access' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    role: updated.role,
    verificationStatus: updated.coordinator_verification_status ?? 'pending',
    message:
      'Organizer access enabled. Submit your business name and registration number to publish markets and collect vendor payments.',
  })
}
