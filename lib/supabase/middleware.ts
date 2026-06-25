import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  ACTIVE_PORTAL_COOKIE,
  canAccessPortal,
  detectPortalFromPath,
  isPatronPortalPath,
  parseActivePortal,
} from '@/lib/portals/active-portal'
import { resolvePostLoginPath } from '@/lib/auth/post-login-redirect'
import {
  DEV_MOCK_ROLE_PARAM,
  devMockLoginPath,
  isDevMockAuthEnabled,
  parseDevMockRole,
} from '@/lib/auth/dev-mock-session'
import {
  accessDeniedRedirect,
  isPathAccessAllowed,
} from '@/lib/auth/rbac'
import {
  ADMIN_SESSION_COOKIE,
  isAdminSessionTokenValid,
  readAdminSessionToken,
} from '@/lib/auth/require-admin'
import { isPublicPath } from '@/lib/auth/public-paths'
import {
  isEmailConfirmed,
  isUnconfirmedUserAllowedPath,
} from '@/lib/auth/email-confirmation'
import type { Role } from '@/types/database'

/**
 * API routes (called via `fetch`) must never be redirected to an HTML page on
 * an auth/permission failure: the browser follows the 3xx and the caller then
 * receives a 200 HTML login/confirm page, which JSON parsing turns into a
 * misleading generic error (e.g. "Could not save market draft"). Return a
 * machine-readable JSON status instead so callers surface the real reason.
 */
function apiAuthErrorResponse(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status })
}

/** Supabase may redirect to Site URL root with ?code= instead of /api/auth/callback. */
function redirectOAuthCodeToCallback(request: NextRequest): NextResponse | null {
  const { pathname, searchParams } = request.nextUrl
  const code = searchParams.get('code')
  if (!code || pathname === '/api/auth/callback') return null
  if (pathname.startsWith('/api/square/oauth/callback')) return null

  const url = request.nextUrl.clone()
  url.pathname = '/api/auth/callback'
  return NextResponse.redirect(url)
}

export async function updateSession(request: NextRequest) {
  // Let the auth callback route exchange the PKCE code without middleware
  // touching cookies first (avoids racing or clearing the code verifier).
  if (request.nextUrl.pathname === '/api/auth/callback') {
    return NextResponse.next({ request })
  }

  const oauthRedirect = redirectOAuthCodeToCallback(request)
  if (oauthRedirect) return oauthRedirect

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isApiRequest = pathname.startsWith('/api/')

  const legacyShopperEvent = pathname.match(/^\/shopper\/events\/([^/]+)\/?$/)
  if (legacyShopperEvent) {
    const url = request.nextUrl.clone()
    url.pathname = `/events/${legacyShopperEvent[1]}`
    return NextResponse.redirect(url, 308)
  }

  if (isDevMockAuthEnabled()) {
    const mockRole = parseDevMockRole(request.nextUrl.searchParams.get(DEV_MOCK_ROLE_PARAM))
    if (mockRole && pathname === '/login') {
      return NextResponse.redirect(new URL(devMockLoginPath(mockRole), request.url))
    }
  }

  const isPublicPathMatch =
    isPublicPath(pathname) ||
    (isDevMockAuthEnabled() && pathname.startsWith('/api/dev/mock-login'))

  if (!user && !isPublicPathMatch) {
    if (isApiRequest) {
      return apiAuthErrorResponse(401, 'Your session expired. Sign in again to continue.')
    }
    const url = request.nextUrl.clone()
    if (pathname === '/coordinator/events/new') {
      url.pathname = '/signup'
      url.searchParams.set('role', 'coordinator')
      url.searchParams.set('next', pathname)
    } else {
      url.pathname = '/login'
      url.searchParams.set('redirectTo', pathname)
    }
    return NextResponse.redirect(url)
  }

  if (user && !isEmailConfirmed(user) && !isPublicPathMatch && !isUnconfirmedUserAllowedPath(pathname)) {
    if (isApiRequest) {
      return apiAuthErrorResponse(
        403,
        'Confirm your email address to continue. Check your inbox for the confirmation link.'
      )
    }
    const url = request.nextUrl.clone()
    url.pathname = '/confirm-email'
    if (user.email) {
      url.searchParams.set('email', user.email)
    }
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  let profileRole: Role | null = null
  let profileIsAdmin = false

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    profileRole = (profile?.role as Role | undefined) ?? 'shopper'
    profileIsAdmin = profile?.is_admin === true

    if (pathname.startsWith('/admin')) {
      const sessionToken = readAdminSessionToken(
        request,
        request.cookies.get(ADMIN_SESSION_COOKIE)?.value
      )
      const hasAdminAccess =
        profileIsAdmin || isAdminSessionTokenValid(sessionToken)
      if (!hasAdminAccess) {
        if (isApiRequest) {
          return apiAuthErrorResponse(403, 'You do not have permission to perform this action.')
        }
        const url = request.nextUrl.clone()
        url.pathname = accessDeniedRedirect(profileRole)
        url.search = ''
        return NextResponse.redirect(url)
      }
    }

    if (!isPathAccessAllowed(pathname, profileRole, profileIsAdmin)) {
      if (isApiRequest) {
        return apiAuthErrorResponse(403, 'You do not have permission to perform this action.')
      }
      const url = request.nextUrl.clone()
      url.pathname = accessDeniedRedirect(profileRole)
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  if (user && isEmailConfirmed(user) && (pathname === '/login' || pathname === '/signup')) {
    const role = profileRole ?? 'shopper'
    const activePortal = parseActivePortal(request.cookies.get(ACTIVE_PORTAL_COOKIE)?.value)
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    const url = request.nextUrl.clone()
    url.pathname = resolvePostLoginPath({
      role,
      redirectTo,
      userAgent: request.headers.get('user-agent'),
      activePortal,
      isAdmin: profileIsAdmin,
    })
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Deep links sync the active portal cookie with the route the user landed on.
  if (user && profileRole) {
    const patronBrowsePath = isPatronPortalPath(pathname)
    const pathPortal = patronBrowsePath ? 'patron' : detectPortalFromPath(pathname)
    const shouldSync =
      patronBrowsePath ||
      (pathPortal !== 'patron' &&
        canAccessPortal(profileRole, pathPortal, { isAdmin: profileIsAdmin }))

    if (shouldSync) {
      const cookiePortal = parseActivePortal(request.cookies.get(ACTIVE_PORTAL_COOKIE)?.value)
      if (cookiePortal !== pathPortal) {
        supabaseResponse.cookies.set(ACTIVE_PORTAL_COOKIE, pathPortal, {
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
          sameSite: 'lax',
        })
      }
    }
  }

  return supabaseResponse
}
