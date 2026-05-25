import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  assertApprovedVendorAtEvent,
  assertFeedReader,
  createFeedPost,
  listFeedPosts,
} from '@/lib/market-feed/posts'
import type { MarketFeedMediaType } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()
  const access = await assertFeedReader(service, eventId, user.id)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const posts = await listFeedPosts(service, eventId, user.id)
  return NextResponse.json({ posts })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    mediaUrl?: string
    mediaType?: MarketFeedMediaType
    caption?: string
  }

  if (!body.mediaUrl?.trim() || !body.mediaType || !body.caption?.trim()) {
    return NextResponse.json(
      { error: 'Media URL, media type, and caption are required.' },
      { status: 400 }
    )
  }

  if (!['image', 'video'].includes(body.mediaType)) {
    return NextResponse.json({ error: 'Invalid media type.' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { data: event } = await service
    .from('events')
    .select('id, status')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  if (!['published', 'active'].includes(event.status)) {
    return NextResponse.json(
      { error: 'This market is not accepting feed posts right now.' },
      { status: 422 }
    )
  }

  const vendorCheck = await assertApprovedVendorAtEvent(service, eventId, user.id)
  if (!vendorCheck.ok) {
    return NextResponse.json({ error: vendorCheck.error }, { status: vendorCheck.status })
  }

  const result = await createFeedPost(service, {
    eventId,
    vendorId: user.id,
    mediaUrl: body.mediaUrl.trim(),
    mediaType: body.mediaType,
    caption: body.caption,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ post: result.post })
}
