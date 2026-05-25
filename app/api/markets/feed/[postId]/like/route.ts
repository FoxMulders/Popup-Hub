import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { toggleFeedPostLike } from '@/lib/market-feed/posts'

interface RouteParams {
  params: Promise<{ postId: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { postId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()
  const result = await toggleFeedPostLike(service, postId, user.id)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    liked: result.liked,
    likesCount: result.likesCount,
  })
}
