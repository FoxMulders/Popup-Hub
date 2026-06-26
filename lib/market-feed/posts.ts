import type { SupabaseClient } from '@supabase/supabase-js'
import { getMarketPatronCheckIn } from '@/lib/market-passport/check-in'
import type { MarketFeedMediaType, MarketFeedPost } from '@/types/database'

export interface MarketFeedPostView {
  id: string
  eventId: string
  vendorId: string
  vendorName: string
  vendorLogoUrl: string | null
  mediaUrl: string
  mediaType: MarketFeedMediaType
  caption: string
  likesCount: number
  commentsCount: number
  likedByMe: boolean
  createdAt: string
}

export interface MarketFeedCommentView {
  id: string
  postId: string
  userId: string
  authorName: string
  authorAvatarUrl: string | null
  body: string
  createdAt: string
}

export function buildVendorProfileHref(eventId: string, vendorId: string): string {
  return `/events/${eventId}/vendors/${vendorId}`
}

export async function assertFeedReader(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const checkIn = await getMarketPatronCheckIn(supabase, eventId, userId)
  if (checkIn) return { ok: true }

  const { data: approvedVendor } = await supabase
    .from('booth_applications')
    .select('id')
    .eq('event_id', eventId)
    .eq('vendor_id', userId)
    .eq('status', 'approved')
    .maybeSingle()

  if (approvedVendor) return { ok: true }

  const { data: event } = await supabase
    .from('events')
    .select('coordinator_id')
    .eq('id', eventId)
    .maybeSingle()

  if (event?.coordinator_id === userId) return { ok: true }

  return {
    ok: false,
    error: 'Check in at the market to view the Meet the Maker feed.',
    status: 403,
  }
}

export async function assertCheckedInPatron(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const checkIn = await getMarketPatronCheckIn(supabase, eventId, userId)
  if (!checkIn) {
    return {
      ok: false,
      error: 'Check in at the market to engage with the feed.',
      status: 403,
    }
  }
  return { ok: true }
}

export async function assertApprovedVendorAtEvent(
  supabase: SupabaseClient,
  eventId: string,
  vendorId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: application } = await supabase
    .from('booth_applications')
    .select('id')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .eq('status', 'approved')
    .maybeSingle()

  if (!application) {
    return {
      ok: false,
      error: 'Only approved vendors at this market can post to the feed.',
      status: 403,
    }
  }
  return { ok: true }
}

async function resolveVendorDisplay(
  supabase: SupabaseClient,
  vendorIds: string[]
): Promise<Map<string, { name: string; logoUrl: string | null }>> {
  const unique = [...new Set(vendorIds)]
  const map = new Map<string, { name: string; logoUrl: string | null }>()
  if (unique.length === 0) return map

  const [{ data: passports }, { data: profiles }] = await Promise.all([
    supabase
      .from('vendor_passports')
      .select('user_id, business_name, logo_url')
      .in('user_id', unique),
    supabase.from('profiles').select('id, full_name, avatar_url').in('id', unique),
  ])

  for (const id of unique) {
    const passport = passports?.find((p) => p.user_id === id)
    const profile = profiles?.find((p) => p.id === id)
    map.set(id, {
      name: passport?.business_name ?? profile?.full_name ?? 'Maker',
      logoUrl: passport?.logo_url ?? profile?.avatar_url ?? null,
    })
  }

  return map
}

export async function listFeedPosts(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<MarketFeedPostView[]> {
  const { data: posts, error } = await supabase
    .from('market_feed_posts')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !posts?.length) return []

  const postIds = posts.map((p) => p.id as string)
  const vendorIds = posts.map((p) => p.vendor_id as string)

  const [{ data: likes }, vendorMap] = await Promise.all([
    supabase
      .from('market_feed_post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds),
    resolveVendorDisplay(supabase, vendorIds),
  ])

  const likedSet = new Set((likes ?? []).map((l) => l.post_id as string))

  return (posts as MarketFeedPost[]).map((post) => {
    const vendor = vendorMap.get(post.vendor_id)
    return {
      id: post.id,
      eventId: post.event_id,
      vendorId: post.vendor_id,
      vendorName: vendor?.name ?? 'Maker',
      vendorLogoUrl: vendor?.logoUrl ?? null,
      mediaUrl: post.media_url,
      mediaType: post.media_type,
      caption: post.caption,
      likesCount: post.likes_count,
      commentsCount: post.comments_count,
      likedByMe: likedSet.has(post.id),
      createdAt: post.created_at,
    }
  })
}

export async function createFeedPost(
  supabase: SupabaseClient,
  input: {
    eventId: string
    vendorId: string
    mediaUrl: string
    mediaType: MarketFeedMediaType
    caption: string
  }
): Promise<
  | { ok: true; post: MarketFeedPostView }
  | { ok: false; error: string; status: number }
> {
  const caption = input.caption.trim()
  if (!caption) {
    return { ok: false, error: 'Caption is required.', status: 400 }
  }

  const { data, error } = await supabase
    .from('market_feed_posts')
    .insert({
      event_id: input.eventId,
      vendor_id: input.vendorId,
      media_url: input.mediaUrl,
      media_type: input.mediaType,
      caption,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not publish post', status: 422 }
  }

  const vendorMap = await resolveVendorDisplay(supabase, [input.vendorId])
  const vendor = vendorMap.get(input.vendorId)
  const post = data as MarketFeedPost

  return {
    ok: true,
    post: {
      id: post.id,
      eventId: post.event_id,
      vendorId: post.vendor_id,
      vendorName: vendor?.name ?? 'Maker',
      vendorLogoUrl: vendor?.logoUrl ?? null,
      mediaUrl: post.media_url,
      mediaType: post.media_type,
      caption: post.caption,
      likesCount: post.likes_count,
      commentsCount: post.comments_count,
      likedByMe: false,
      createdAt: post.created_at,
    },
  }
}

export async function toggleFeedPostLike(
  supabase: SupabaseClient,
  postId: string,
  userId: string
): Promise<
  | { ok: true; liked: boolean; likesCount: number }
  | { ok: false; error: string; status: number }
> {
  const { data: post } = await supabase
    .from('market_feed_posts')
    .select('id, event_id, likes_count')
    .eq('id', postId)
    .maybeSingle()

  if (!post) {
    return { ok: false, error: 'Post not found.', status: 404 }
  }

  const patronCheck = await assertCheckedInPatron(supabase, post.event_id, userId)
  if (!patronCheck.ok) return patronCheck

  const { data: existing } = await supabase
    .from('market_feed_post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('market_feed_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)

    if (error) {
      return { ok: false, error: error.message, status: 422 }
    }

    const { data: refreshed } = await supabase
      .from('market_feed_posts')
      .select('likes_count')
      .eq('id', postId)
      .single()

    return {
      ok: true,
      liked: false,
      likesCount: refreshed?.likes_count ?? Math.max(0, post.likes_count - 1),
    }
  }

  const { error } = await supabase.from('market_feed_post_likes').insert({
    post_id: postId,
    user_id: userId,
  })

  if (error) {
    return { ok: false, error: error.message, status: 422 }
  }

  const { data: refreshed } = await supabase
    .from('market_feed_posts')
    .select('likes_count')
    .eq('id', postId)
    .single()

  return {
    ok: true,
    liked: true,
    likesCount: refreshed?.likes_count ?? post.likes_count + 1,
  }
}

export async function listFeedPostComments(
  supabase: SupabaseClient,
  postId: string
): Promise<MarketFeedCommentView[]> {
  const { data: comments } = await supabase
    .from('market_feed_post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(200)

  if (!comments?.length) return []

  const userIds = comments.map((c) => c.user_id as string)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds)

  return comments.map((comment) => {
    const profile = profiles?.find((p) => p.id === comment.user_id)
    return {
      id: comment.id as string,
      postId: comment.post_id as string,
      userId: comment.user_id as string,
      authorName: profile?.full_name ?? 'Patron',
      authorAvatarUrl: profile?.avatar_url ?? null,
      body: comment.body as string,
      createdAt: comment.created_at as string,
    }
  })
}

export async function addFeedPostComment(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
  body: string
): Promise<
  | { ok: true; comment: MarketFeedCommentView; commentsCount: number }
  | { ok: false; error: string; status: number }
> {
  const trimmed = body.trim()
  if (!trimmed) {
    return { ok: false, error: 'Comment cannot be empty.', status: 400 }
  }
  if (trimmed.length > 500) {
    return { ok: false, error: 'Comment is too long (500 characters max).', status: 400 }
  }

  const { data: post } = await supabase
    .from('market_feed_posts')
    .select('id, event_id, comments_count')
    .eq('id', postId)
    .maybeSingle()

  if (!post) {
    return { ok: false, error: 'Post not found.', status: 404 }
  }

  const patronCheck = await assertCheckedInPatron(supabase, post.event_id, userId)
  if (!patronCheck.ok) return patronCheck

  const { data, error } = await supabase
    .from('market_feed_post_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      body: trimmed,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not post comment', status: 422 }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  const { data: refreshed } = await supabase
    .from('market_feed_posts')
    .select('comments_count')
    .eq('id', postId)
    .single()

  return {
    ok: true,
    comment: {
      id: data.id,
      postId: data.post_id,
      userId: data.user_id,
      authorName: profile?.full_name ?? 'Patron',
      authorAvatarUrl: profile?.avatar_url ?? null,
      body: data.body,
      createdAt: data.created_at,
    },
    commentsCount: refreshed?.comments_count ?? post.comments_count + 1,
  }
}

export function mapRowToFeedPostView(
  row: MarketFeedPost,
  vendor: { name: string; logoUrl: string | null } | undefined,
  likedByMe: boolean
): MarketFeedPostView {
  return {
    id: row.id,
    eventId: row.event_id,
    vendorId: row.vendor_id,
    vendorName: vendor?.name ?? 'Maker',
    vendorLogoUrl: vendor?.logoUrl ?? null,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    caption: row.caption,
    likesCount: row.likes_count,
    commentsCount: row.comments_count,
    likedByMe,
    createdAt: row.created_at,
  }
}
