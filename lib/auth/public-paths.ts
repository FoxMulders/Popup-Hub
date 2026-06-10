/** Paths that do not require authentication (must stay in sync with middleware). */
export function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/auth/callback',
    '/auth/confirm',
    '/api/auth/callback',
  ]

  if (publicPaths.includes(pathname)) return true

  return (
    pathname.startsWith('/discover') ||
    pathname.startsWith('/favorites') ||
    pathname.startsWith('/events/') ||
    pathname.startsWith('/auctions/') ||
    pathname.startsWith('/coordinators/') ||
    pathname.startsWith('/patrons/') ||
    pathname.startsWith('/checkin/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/square/webhook') ||
    pathname.startsWith('/api/square/oauth/callback') ||
    pathname.startsWith('/api/reminders/') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/site.webmanifest' ||
    pathname === '/version' ||
    pathname === '/api/build-info' ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/legal/') ||
    pathname.startsWith('/wallet/door')
  )
}
