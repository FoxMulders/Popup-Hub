import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  addFeedPostComment,
  assertFeedReader,
  listFeedPostComments,
} from '@/lib/market-feed/posts'

interface RouteParams {
  params: Promise<{ postId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { postId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  const { data: post } = await service
    .from('market_feed_posts')
    .select('event_id')
    .eq('id', postId)
    .maybeSingle()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const access = await assertFeedReader(service, post.event_id, user.id)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const comments = await listFeedPostComments(service, postId)
  return NextResponse.json({ comments })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { postId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { body?: string }
  if (!body.body?.trim()) {
    return NextResponse.json({ error: 'Comment body is required.' }, { status: 400 })
  }

  const service = await createServiceClient()
  const result = await addFeedPostComment(service, postId, user.id, body.body)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    comment: result.comment,
    commentsCount: result.commentsCount,
  })
}
