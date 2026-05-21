import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
    pathname.startsWith('/events/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/square/webhook') ||
    pathname.startsWith('/favicon')

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'shopper'
    const url = request.nextUrl.clone()
    url.pathname = getRoleDashboard(role)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

function getRoleDashboard(role: string): string {
  switch (role) {
    case 'vendor':
      return '/vendor/dashboard'
    case 'coordinator':
      return '/coordinator/dashboard'
    default:
      return '/shopper/dashboard'
  }
}
