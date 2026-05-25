import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { recordPassportScan } from '@/lib/market-passport/passport'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    token?: string
    vendorId?: string
    eventId?: string
  }

  if (!body.token && (!body.vendorId || !body.eventId)) {
    return NextResponse.json(
      { error: 'Scan token or vendor and market IDs are required.' },
      { status: 400 }
    )
  }

  const service = await createServiceClient()
  const result = await recordPassportScan(service, {
    userId: user.id,
    token: body.token,
    vendorId: body.vendorId,
    eventId: body.eventId,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    alreadyScanned: result.alreadyScanned,
    vendorName: result.vendorName,
    scannedAt: result.scan.scanned_at,
    progress: result.progress,
  })
}
