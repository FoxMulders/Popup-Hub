import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { parseGoogleDocContractText } from '@/lib/booth-contract/parse-google-doc'
import {
  exportGoogleDocPlainText,
  fetchGoogleDocTitle,
  getGoogleOAuthClientId,
  getGoogleOAuthClientSecret,
  refreshGoogleAccessToken,
} from '@/lib/google/oauth'

export async function POST(request: Request) {
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

  const body = (await request.json()) as { docId?: string }
  const docId = body.docId?.trim()
  if (!docId) {
    return NextResponse.json({ error: 'docId is required' }, { status: 400 })
  }

  const clientId = getGoogleOAuthClientId()
  const clientSecret = getGoogleOAuthClientSecret()
  if (!clientId || !clientSecret || !profile?.google_refresh_token) {
    return NextResponse.json({ error: 'Google account not connected' }, { status: 400 })
  }

  let accessToken = profile.google_access_token
  const expiresAt = profile.google_token_expires_at
    ? new Date(profile.google_token_expires_at).getTime()
    : 0
  if (!accessToken || Date.now() > expiresAt - 60_000) {
    const refreshed = await refreshGoogleAccessToken({
      refreshToken: profile.google_refresh_token,
      clientId,
      clientSecret,
    })
    accessToken = refreshed.access_token
    await supabase
      .from('profiles')
      .update({
        google_access_token: refreshed.access_token,
        google_token_expires_at: refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
          : null,
      })
      .eq('id', user.id)
  }

  try {
    const [text, title] = await Promise.all([
      exportGoogleDocPlainText(accessToken!, docId),
      fetchGoogleDocTitle(accessToken!, docId),
    ])
    const clauses = parseGoogleDocContractText(text)
    return NextResponse.json({ title, clauses })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
