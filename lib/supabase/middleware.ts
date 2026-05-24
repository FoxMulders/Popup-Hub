import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getDefaultDashboard, parseActivePortal, ACTIVE_PORTAL_COOKIE } from '@/lib/portals/active-portal'
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
import { isPublicPath } from '@/lib/auth/public-paths'
import type { Role } from '@/types/database'

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
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  let profileRole: Role | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    profileRole = (profile?.role as Role | undefined) ?? 'shopper'

    if (!isPathAccessAllowed(pathname, profileRole)) {
      const url = request.nextUrl.clone()
      url.pathname = accessDeniedRedirect(profileRole)
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const role = profileRole ?? 'shopper'
    const activePortal = parseActivePortal(request.cookies.get(ACTIVE_PORTAL_COOKIE)?.value)
    const url = request.nextUrl.clone()
    url.pathname = getDefaultDashboard(role, 0, activePortal)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
