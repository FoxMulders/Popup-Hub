import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { listPassportStories } from '@/lib/passport-stories/stories'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ownerId = searchParams.get('ownerId')

  if (!ownerId) {
    return NextResponse.json({ error: 'ownerId is required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const stories = await listPassportStories(service, ownerId)
  return NextResponse.json({ stories })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    mediaUrl?: string
    mediaType?: 'video' | 'image'
    durationSeconds?: number | null
    storyKind?: 'behind_the_brand' | 'market_promo' | 'story'
    caption?: string | null
  }

  if (!body.mediaUrl?.trim() || !body.mediaType) {
    return NextResponse.json({ error: 'Media URL and type are required.' }, { status: 400 })
  }

  if (!['video', 'image'].includes(body.mediaType)) {
    return NextResponse.json({ error: 'Invalid media type.' }, { status: 400 })
  }

  const { createPassportStory } = await import('@/lib/passport-stories/stories')
  const service = await createServiceClient()
  const result = await createPassportStory(service, {
    ownerId: user.id,
    createdBy: user.id,
    mediaUrl: body.mediaUrl.trim(),
    mediaType: body.mediaType,
    durationSeconds: body.durationSeconds ?? null,
    storyKind: body.storyKind ?? 'story',
    caption: body.caption ?? null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ story: result.story })
}
