import { NextResponse } from 'next/server'

/** Returns an error response when unauthorized; null when the cron request may proceed. */
export function authorizeCronRequest(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'

  if (!cronSecret) {
    if (isProduction) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
    }
    return null
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
