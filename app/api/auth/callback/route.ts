import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { parseActivePortal, ACTIVE_PORTAL_COOKIE } from '@/lib/portals/active-portal'
import { resolvePostLoginPath } from '@/lib/auth/post-login-redirect'
import { findDuplicateProfilesByEmail } from '@/lib/auth/duplicate-account'
import { isGenuineOAuthLinkFlow } from '@/lib/auth/oauth-link-flow'
import { createAdminClient } from '@/lib/supabase/server'

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

function attachCookies(
  response: NextResponse,
  cookiesToSet: { name: string; value: string; options: CookieOptions }[]
): NextResponse {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  return response
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

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const origin = resolveRedirectOrigin(request)
  const code = requestUrl.searchParams.get('code')
  const next = safeRedirectPath(requestUrl.searchParams.get('next'))
  const roleParam = requestUrl.searchParams.get('role')
  const linkFlag = requestUrl.searchParams.get('link') === '1'

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
  const sessionCookies: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Read PKCE verifier from the incoming request cookies (set by the browser client).
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
            sessionCookies.push({ name, value, options })
          })
        },
      },
    }
  )

  const {
    data: { user: userBeforeExchange },
  } = await supabase.auth.getUser()

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

  const isLinkFlow = isGenuineOAuthLinkFlow(linkFlag, userBeforeExchange?.id, user.id)

  if (!isLinkFlow && user.email) {
    const admin = createAdminClient()
    const duplicates = await findDuplicateProfilesByEmail(admin, user.email, user.id)
    if (duplicates.length > 0) {
      await supabase.auth.signOut()

      const accountLinkUrl = new URL('/account-link', origin)
      accountLinkUrl.searchParams.set('email', user.email)
      accountLinkUrl.searchParams.set('duplicateOf', duplicates[0].id)

      return attachCookies(
        NextResponse.redirect(accountLinkUrl.toString()),
        sessionCookies
      )
    }
  }

  if (isLinkFlow) {
    return attachCookies(
      NextResponse.redirect(`${origin}/profile?linked=1`),
      sessionCookies
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

  let redirectPath = next
  if (profile) {
    const activePortal = parseActivePortal(cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value)
    redirectPath = resolvePostLoginPath({
      role: profile.role,
      redirectTo: next,
      userAgent: request.headers.get('user-agent'),
      activePortal,
    })
  }

  return attachCookies(NextResponse.redirect(`${origin}${redirectPath}`), sessionCookies)
}
