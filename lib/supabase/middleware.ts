import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getDefaultDashboard } from '@/lib/portals/active-portal'
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
import type { Role } from '@/types/database'

export async function updateSession(request: NextRequest) {
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

  if (isDevMockAuthEnabled()) {
    const mockRole = parseDevMockRole(request.nextUrl.searchParams.get(DEV_MOCK_ROLE_PARAM))
    if (mockRole && pathname === '/login') {
      return NextResponse.redirect(new URL(devMockLoginPath(mockRole), request.url))
    }
  }

  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/auth/callback',
    '/auth/confirm',
    '/api/auth/callback',
  ]

  const isPublicPath =
    publicPaths.includes(pathname) ||
    pathname.startsWith('/discover') ||
    pathname.startsWith('/events/') ||
    pathname.startsWith('/auctions/') ||
    pathname.startsWith('/coordinators/') ||
    pathname.startsWith('/checkin/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/square/webhook') ||
    pathname.startsWith('/api/reminders/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname.startsWith('/icons/') ||
    (isDevMockAuthEnabled() && pathname.startsWith('/api/dev/mock-login'))

  if (!user && !isPublicPath) {
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
    const { count } = await supabase
      .from('coordinator_vendor_approvals')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_user_id', user.id)

    const url = request.nextUrl.clone()
    url.pathname = getDefaultDashboard(role, count ?? 0)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
