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

  const body = (await request.json()) as { token?: string; platform?: string }
  const token = body.token?.trim()
  const platform = body.platform?.trim()

  if (!token || !platform) {
    return NextResponse.json({ error: 'token and platform required' }, { status: 400 })
  }

  if (!['ios', 'android', 'web'].includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }

  const { error } = await supabase.from('device_push_tokens').upsert(
    {
      user_id: user.id,
      token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { token?: string }
  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('device_push_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('token', token)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
