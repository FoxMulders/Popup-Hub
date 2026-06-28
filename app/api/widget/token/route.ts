import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { mintWidgetToken } from '@/lib/widget/token-crypto'
import { resolveWidgetPersonaForAccount } from '@/lib/widget/auth'
import { resolveActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'
import type { WidgetSnapshot } from '@/lib/widget/types'

function apiBaseUrl(request: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (env) return env.replace(/\/$/, '')
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

/** Mint or rotate a widget token for the signed-in native app session. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { label?: string; rotate?: boolean }
  const label = body.label?.trim() || 'native-widget'
  const service = await createServiceClient()

  if (body.rotate !== false) {
    await service
      .from('widget_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('revoked_at', null)
  }

  const { raw, hash } = mintWidgetToken()
  const { data: row, error } = await service
    .from('widget_tokens')
    .insert({
      user_id: user.id,
      token_hash: hash,
      label,
    })
    .select('id, created_at')
    .single()

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? 'Failed to mint token' }, { status: 500 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  const activePortal = resolveActivePortal(undefined, profile as Profile | null)
  const persona = resolveWidgetPersonaForAccount(profile?.role ?? 'shopper', profile?.is_admin === true)

  const snapshot: WidgetSnapshot = {
    userId: user.id,
    role: (profile?.role ?? 'shopper') as Profile['role'],
    activePortal,
    persona,
    apiBaseUrl: apiBaseUrl(request),
    savedAt: new Date().toISOString(),
  }

  return NextResponse.json({
    token: raw,
    tokenId: row.id,
    snapshot,
  })
}

/** Revoke all active widget tokens for the signed-in user. */
export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()
  const { error } = await service
    .from('widget_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('revoked_at', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
