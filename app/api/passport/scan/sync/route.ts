import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { recordPassportScan } from '@/lib/market-passport/passport'

/**
 * Background-sync endpoint for queued offline passport scans.
 * Accepts the same signed token payload as `/api/passport/scan`.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { token?: string; queuedAt?: number }
  if (!body.token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const result = await recordPassportScan(service, {
    userId: user.id,
    token: body.token,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    synced: true,
    queuedAt: body.queuedAt ?? null,
    alreadyScanned: result.alreadyScanned,
    vendorName: result.vendorName,
    progress: result.progress,
  })
}
