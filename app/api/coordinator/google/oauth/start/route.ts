import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  buildGoogleOAuthUrl,
  getGoogleOAuthClientId,
  getGoogleOAuthRedirectUri,
} from '@/lib/google/oauth'
import { buildGoogleOAuthState, googleOAuthReturnUrl } from '@/lib/google/oauth-return'

function safeReturnTo(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return '/coordinator/events/new'
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin
  const returnTo = safeReturnTo(requestUrl.searchParams.get('return_to'))

  const clientId = getGoogleOAuthClientId()
  if (!clientId) {
    return NextResponse.redirect(
      googleOAuthReturnUrl(origin, returnTo, 'error_not_configured')
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`/login?redirectTo=${encodeURIComponent(returnTo)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.redirect(googleOAuthReturnUrl(origin, returnTo, 'error_forbidden'))
  }

  const redirectUri = getGoogleOAuthRedirectUri(origin)
  const url = buildGoogleOAuthUrl({
    clientId,
    redirectUri,
    state: buildGoogleOAuthState(user.id, returnTo),
  })

  return NextResponse.redirect(url)
}
