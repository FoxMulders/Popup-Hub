import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { extractClientIp } from '@/lib/audit/security-audit-log'
import { hashClientIpForAdClick, recordAdClick } from '@/lib/markets/ad-click-tracking'

interface TrackClickBody {
  vendorId?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: marketId } = await params
  const service = createAdminClient()

  const { data: market, error: marketError } = await service
    .from('events')
    .select('id, is_external_listing, destination_url')
    .eq('id', marketId)
    .maybeSingle()

  if (marketError) {
    console.error('[track-click]', marketError.message)
    return NextResponse.json({ error: 'Could not load market' }, { status: 500 })
  }

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  if (market.is_external_listing !== true) {
    return NextResponse.json(
      { error: 'Track-click is only available for external listings' },
      { status: 400 }
    )
  }

  const destinationUrl = market.destination_url?.trim()
  if (!destinationUrl) {
    return NextResponse.json(
      { error: 'Market has no destination URL configured' },
      { status: 400 }
    )
  }

  let body: TrackClickBody = {}
  try {
    const raw = await request.text()
    if (raw.trim()) {
      body = JSON.parse(raw) as TrackClickBody
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const clientIp = extractClientIp(request) ?? 'unknown'
  const ipAddressHash = hashClientIpForAdClick(clientIp)
  const userAgent = request.headers.get('user-agent')

  try {
    await recordAdClick(service, {
      marketId,
      vendorId: body.vendorId?.trim() || null,
      ipAddressHash,
      userAgent,
    })
  } catch (err) {
    console.error('[track-click] insert failed', err)
    return NextResponse.json({ error: 'Could not record click' }, { status: 500 })
  }

  let redirectTarget: URL
  try {
    redirectTarget = new URL(destinationUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid destination URL' }, { status: 400 })
  }

  return NextResponse.redirect(redirectTarget.toString(), 302)
}
