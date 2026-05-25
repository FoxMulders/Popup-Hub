'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Megaphone, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeedPostCard } from '@/components/market-feed/feed-post-card'
import type { MarketFeedPostView } from '@/lib/market-feed/posts'
import type { MarketFeedPost } from '@/types/database'
import { mapRowToFeedPostView } from '@/lib/market-feed/posts'

interface MeetTheMakerFeedProps {
  eventId: string
}

function sortPosts(posts: MarketFeedPostView[]): MarketFeedPostView[] {
  return [...posts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function MeetTheMakerFeed({ eventId }: MeetTheMakerFeedProps) {
  const [posts, setPosts] = useState<MarketFeedPostView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadFeed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`/api/markets/${eventId}/feed`)
      const json = (await res.json()) as { posts?: MarketFeedPostView[]; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Could not load feed')
        return
      }
      setPosts(sortPosts(json.posts ?? []))
    } catch {
      setError('Network error loading feed')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [eventId])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`market-feed:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'market_feed_posts',
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const row = payload.new as MarketFeedPost
          setPosts((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev
            const next = [
              mapRowToFeedPostView(row, { name: 'Maker', logoUrl: null }, false),
              ...prev,
            ]
            return sortPosts(next)
          })
          void loadFeed(true)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'market_feed_posts',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = payload.new as MarketFeedPost
          setPosts((prev) =>
            prev.map((p) =>
              p.id === row.id
                ? {
                    ...p,
                    likesCount: row.likes_count,
                    commentsCount: row.comments_count,
                  }
                : p
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, loadFeed])

  function handleLikeChange(postId: string, liked: boolean, likesCount: number) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likedByMe: liked, likesCount } : p))
    )
  }

  function handleCommentsCountChange(postId: string, count: number) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentsCount: count } : p))
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border bg-white py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading maker stories…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void loadFeed()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-harvest-600" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Live stories from makers — heart posts and join the conversation before bidding.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={refreshing}
          onClick={() => void loadFeed(true)}
        >
          <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white py-14 text-center">
          <p className="text-sm font-medium text-foreground">No stories yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendors will start sharing spotlights as the market goes live.
          </p>
        </div>
      ) : (
        <div className="columns-1 gap-4 md:columns-2">
          {posts.map((post) => (
            <div key={post.id} className="mb-4">
              <FeedPostCard
                post={post}
                onLikeChange={handleLikeChange}
                onCommentsCountChange={handleCommentsCountChange}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
