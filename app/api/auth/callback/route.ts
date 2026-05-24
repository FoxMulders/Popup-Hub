import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getDefaultDashboard, parseActivePortal, ACTIVE_PORTAL_COOKIE } from '@/lib/portals/active-portal'

function safeRedirectPath(value: string | null, fallback = '/'): string {
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

function resolveRedirectOrigin(request: Request, fallbackOrigin: string): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'

  if (process.env.NODE_ENV === 'development') {
    return fallbackOrigin
  }

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return fallbackOrigin
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const redirectOrigin = resolveRedirectOrigin(request, origin)

  const oauthError = searchParams.get('error')
  if (oauthError) {
    if (oauthError === 'access_denied') {
      return loginErrorRedirect(redirectOrigin, 'oauth_cancelled')
    }
    const description = searchParams.get('error_description') ?? oauthError
    return loginErrorRedirect(redirectOrigin, 'oauth_failed', description)
  }

  const code = searchParams.get('code')
  const next = safeRedirectPath(searchParams.get('next'))
  const roleParam = searchParams.get('role')

  if (!code) {
    return loginErrorRedirect(redirectOrigin, 'auth_callback_missing_code')
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
    return loginErrorRedirect(redirectOrigin, 'auth_callback_failed', error.message)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return loginErrorRedirect(
      redirectOrigin,
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
    return NextResponse.redirect(`${redirectOrigin}${dashboard}`)
  }

  return NextResponse.redirect(`${redirectOrigin}${next}`)
}
