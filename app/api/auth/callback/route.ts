import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { parseActivePortal, ACTIVE_PORTAL_COOKIE } from '@/lib/portals/active-portal'
import { resolvePostLoginPath } from '@/lib/auth/post-login-redirect'

function safeRedirectPath(value: string | null, fallback = '/discover'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }
  return value
}

function loginErrorRedirect(
  origin: string,
  error: string,
  detail?: string
): NextResponse {
  const url = new URL('/login', origin)
  url.searchParams.set('error', error)
  if (detail) {
    url.searchParams.set('detail', detail)
  }
  return NextResponse.redirect(url)
}

/** Prefer the live request host (custom domain, preview, or localhost) over configured env URLs. */
function resolveRedirectOrigin(request: Request): string {
  const requestUrl = new URL(request.url)

  const forwardedHost = request.headers.get('x-forwarded-host')
  const hostHeader = request.headers.get('host')
  const host = (forwardedHost ?? hostHeader)?.split(',')[0]?.trim()

  const forwardedProto = request.headers.get('x-forwarded-proto')
  const proto = (forwardedProto ?? requestUrl.protocol.replace(':', '')).replace(/:$/, '')

  if (host) {
    return `${proto}://${host}`
  }

  return requestUrl.origin
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = resolveRedirectOrigin(request)
  const code = requestUrl.searchParams.get('code')
  const next = safeRedirectPath(requestUrl.searchParams.get('next'))
  const roleParam = requestUrl.searchParams.get('role')

  const oauthError = requestUrl.searchParams.get('error')
  if (oauthError) {
    if (oauthError === 'access_denied') {
      return loginErrorRedirect(origin, 'oauth_cancelled')
    }
    const description = requestUrl.searchParams.get('error_description') ?? oauthError
    return loginErrorRedirect(origin, 'oauth_failed', description)
  }

  if (!code) {
    return loginErrorRedirect(origin, 'auth_callback_missing_code')
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return loginErrorRedirect(origin, 'auth_callback_failed', error.message)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return loginErrorRedirect(
      origin,
      'auth_callback_failed',
      'No user returned after sign-in.'
    )
  }

  if (roleParam === 'coordinator') {
    await supabase.rpc('apply_signup_role', { p_role: 'coordinator' })
  }

  if (roleParam === 'vendor') {
    await supabase.rpc('apply_signup_role', { p_role: 'vendor' })
  }

  const shareCookie = cookieStore.get('signup_share_contact')?.value
  if (shareCookie === '1' || shareCookie === '0') {
    await supabase
      .from('profiles')
      .update({ share_contact_with_vendors: shareCookie === '1' })
      .eq('id', user.id)
    cookieStore.delete('signup_share_contact')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile) {
    const activePortal = parseActivePortal(cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value)
    const dashboard = getDefaultDashboard(profile.role, 0, activePortal)
    return NextResponse.redirect(`${origin}${dashboard}`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
