import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  getGoogleOAuthClientId,
  getGoogleOAuthClientSecret,
  listGoogleDocs,
  refreshGoogleAccessToken,
} from '@/lib/google/oauth'

async function resolveAccessToken(
  profile: {
    google_access_token: string | null
    google_refresh_token: string | null
    google_token_expires_at: string | null
  },
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const clientId = getGoogleOAuthClientId()
  const clientSecret = getGoogleOAuthClientSecret()
  if (!clientId || !clientSecret) return null

  const expiresAt = profile.google_token_expires_at
    ? new Date(profile.google_token_expires_at).getTime()
    : 0
  const needsRefresh = !profile.google_access_token || Date.now() > expiresAt - 60_000

  if (!needsRefresh && profile.google_access_token) {
    return profile.google_access_token
  }

  if (!profile.google_refresh_token) return null

  const refreshed = await refreshGoogleAccessToken({
    refreshToken: profile.google_refresh_token,
    clientId,
    clientSecret,
  })

  const newExpires = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null

  await supabase
    .from('profiles')
    .update({
      google_access_token: refreshed.access_token,
      google_token_expires_at: newExpires,
    })
    .eq('id', userId)

  return refreshed.access_token
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'role, is_admin, google_access_token, google_refresh_token, google_token_expires_at'
    )
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const accessToken = profile
    ? await resolveAccessToken(profile, supabase, user.id)
    : null

  if (!accessToken) {
    return NextResponse.json({ connected: false, docs: [] })
  }

  try {
    const docs = await listGoogleDocs(accessToken)
    return NextResponse.json({ connected: true, docs })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list docs'
    return NextResponse.json({ error: message, connected: true }, { status: 502 })
  }
}
