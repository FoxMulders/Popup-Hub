import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { token?: string }
  const { token } = body
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('accept_vendor_invitation', { p_token: token })

  if (error) {
    const message = error.message.includes('expired')
      ? 'Invitation expired'
      : error.message.includes('Invalid')
        ? 'Invalid invitation'
        : error.message.includes('not for this account')
          ? 'Invitation not for this account'
          : 'Activation failed'
    const status = message === 'Invitation expired' ? 410 : message === 'Invalid invitation' ? 404 : 403
    return NextResponse.json({ error: message }, { status })
  }

  const result = data as { ok?: boolean; redirect?: string; already_accepted?: boolean }
  return NextResponse.json({
    ok: true,
    already_accepted: result.already_accepted ?? false,
    redirect: result.redirect ?? '/vendor/passport',
  })
}
