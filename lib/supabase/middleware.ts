import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getDefaultDashboard } from '@/lib/portals/active-portal'
import {
  isShopperBlockedPath,
  isShopperRole,
  SHOPPER_BLOCKED_REDIRECT,
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

  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/auth/callback',
    '/auth/confirm',
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
    pathname.startsWith('/favicon')

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

    if (isShopperRole(profileRole) && isShopperBlockedPath(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = SHOPPER_BLOCKED_REDIRECT
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
