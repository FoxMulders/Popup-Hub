/** Paths that do not require authentication (must stay in sync with middleware). */
export function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/confirm-email',
    '/auth/callback',
    '/auth/confirm',
    '/api/auth/callback',
    '/api/auth/apple/notifications',
    '/api/geocode',
  ]

  if (publicPaths.includes(pathname)) return true

  return (
    pathname.startsWith('/discover') ||
    pathname.startsWith('/check') ||
    pathname.startsWith('/organizers/') ||
    pathname.startsWith('/for-organizers') ||
    pathname.startsWith('/compare') ||
    pathname.startsWith('/for-vendors') ||
    pathname.startsWith('/markets/') ||
    pathname.startsWith('/supplies') ||
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
    (pathname.startsWith('/api/v1/markets/') && pathname.endsWith('/track-click')) ||
    pathname.startsWith('/favicon') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/site.webmanifest' ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/version' ||
    pathname === '/api/build-info' ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/legal/') ||
    pathname === '/contact' ||
    pathname.startsWith('/wallet/door')
  )
}
