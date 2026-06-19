import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  buildGoogleOAuthUrl,
  getGoogleOAuthClientId,
  getGoogleOAuthRedirectUri,
} from '@/lib/google/oauth'

export async function GET(request: Request) {
  const clientId = getGoogleOAuthClientId()
  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth is not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const origin = new URL(request.url).origin
  const redirectUri = getGoogleOAuthRedirectUri(origin)
  const url = buildGoogleOAuthUrl({
    clientId,
    redirectUri,
    state: user.id,
  })

  return NextResponse.redirect(url)
}
