'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Heart, Loader2, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import { cn } from '@/lib/utils'
import {
  buildVendorProfileHref,
  type MarketFeedCommentView,
  type MarketFeedPostView,
} from '@/lib/market-feed/posts'

interface FeedPostCommentsProps {
  postId: string
  commentsCount: number
  onCommentsCountChange: (count: number) => void
}

export function FeedPostComments({
  postId,
  commentsCount,
  onCommentsCountChange,
}: FeedPostCommentsProps) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comments, setComments] = useState<MarketFeedCommentView[]>([])
  const [draft, setDraft] = useState('')
  const loadedRef = useRef(false)

  const loadComments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/markets/feed/${postId}/comments`)
      const json = (await res.json()) as {
        comments?: MarketFeedCommentView[]
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? 'Could not load comments')
        return
      }
      setComments(json.comments ?? [])
      loadedRef.current = true
    } catch {
      setError('Network error loading comments')
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    if (open && !loadedRef.current) {
      void loadComments()
    }
  }, [open, loadComments])

  async function handleSubmit() {
    const body = draft.trim()
    if (!body || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/markets/feed/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const json = (await res.json()) as {
        comment?: MarketFeedCommentView
        commentsCount?: number
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? 'Could not post comment')
        return
      }
      if (json.comment) {
        setComments((prev) => [...prev, json.comment!])
      }
      if (typeof json.commentsCount === 'number') {
        onCommentsCountChange(json.commentsCount)
      }
      setDraft('')
    } catch {
      setError('Network error posting comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border-t border-stone-100 pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <MessageCircle className="h-4 w-4" />
        {commentsCount === 0
          ? 'Start the conversation'
          : `${commentsCount} comment${commentsCount === 1 ? '' : 's'}`}
      </button>

      {open ? (
        <div id={panelId} className="mt-3 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading comments…
            </div>
          ) : null}

          {!loading && comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Be the first to comment on this story.</p>
          ) : null}

          <ul className="max-h-56 space-y-3 overflow-y-auto pr-1">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-2">
                <VendorLogo
                  src={comment.authorAvatarUrl}
                  alt=""
                  fallback={comment.authorName.slice(0, 2).toUpperCase()}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">{comment.authorName}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{comment.body}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              maxLength={500}
              className="min-h-[72px] resize-none text-sm"
            />
            <Button
              type="button"
              size="icon"
              className="shrink-0 self-end"
              disabled={!draft.trim() || submitting}
              aria-label="Post comment"
              onClick={() => void handleSubmit()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

interface FeedPostCardProps {
  post: MarketFeedPostView
  onLikeChange: (postId: string, liked: boolean, likesCount: number) => void
  onCommentsCountChange: (postId: string, count: number) => void
}

export function FeedPostCard({ post, onLikeChange, onCommentsCountChange }: FeedPostCardProps) {
  const [liked, setLiked] = useState(post.likedByMe)
  const [likesCount, setLikesCount] = useState(post.likesCount)
  const [commentsCount, setCommentsCount] = useState(post.commentsCount)
  const [liking, setLiking] = useState(false)
  const [likeError, setLikeError] = useState<string | null>(null)

  useEffect(() => {
    setLiked(post.likedByMe)
    setLikesCount(post.likesCount)
    setCommentsCount(post.commentsCount)
  }, [post.likedByMe, post.likesCount, post.commentsCount])

  async function handleLikeToggle() {
    if (liking) return

    const nextLiked = !liked
    const optimisticCount = Math.max(0, likesCount + (nextLiked ? 1 : -1))
    setLiked(nextLiked)
    setLikesCount(optimisticCount)
    setLikeError(null)
    setLiking(true)

    try {
      const res = await fetch(`/api/markets/feed/${post.id}/like`, { method: 'POST' })
      const json = (await res.json()) as {
        liked?: boolean
        likesCount?: number
        error?: string
      }

      if (!res.ok) {
        setLiked(liked)
        setLikesCount(likesCount)
        setLikeError(json.error ?? 'Could not update like')
        return
      }

      const resolvedLiked = !!json.liked
      const resolvedCount = json.likesCount ?? optimisticCount
      setLiked(resolvedLiked)
      setLikesCount(resolvedCount)
      onLikeChange(post.id, resolvedLiked, resolvedCount)
    } catch {
      setLiked(liked)
      setLikesCount(likesCount)
      setLikeError('Network error')
    } finally {
      setLiking(false)
    }
  }

  const vendorHref = buildVendorProfileHref(post.eventId, post.vendorId)
  const initials = post.vendorName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <article className="break-inside-avoid overflow-hidden rounded-2xl border bg-white shadow-sm">
      <header className="flex items-center gap-3 px-4 pt-4">
        <Link href={vendorHref} className="shrink-0 rounded-full ring-offset-2 focus-visible:ring-2">
          <VendorLogo
            src={post.vendorLogoUrl}
            alt={`${post.vendorName} logo`}
            fallback={initials}
            size="sm"
          />
        </Link>
        <div className="min-w-0">
          <Link
            href={vendorHref}
            className="truncate text-sm font-semibold text-foreground hover:text-harvest-700 hover:underline"
          >
            {post.vendorName}
          </Link>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </p>
        </div>
      </header>

      <div className="mt-3 overflow-hidden bg-stone-950">
        {post.mediaType === 'video' ? (
          <video
            src={post.mediaUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-[420px] w-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.mediaUrl}
            alt=""
            className="max-h-[420px] w-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      <div className="space-y-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-pressed={liked}
            aria-label={liked ? 'Unlike post' : 'Like post'}
            disabled={liking}
            className={cn(
              'inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm font-medium transition-colors',
              liked ? 'text-rose-600' : 'text-muted-foreground hover:text-rose-500'
            )}
            onClick={() => void handleLikeToggle()}
          >
            <Heart className={cn('h-5 w-5', liked && 'fill-current')} />
            {likesCount}
          </button>
        </div>

        {likeError ? <p className="text-xs text-destructive">{likeError}</p> : null}

        <p className="text-sm leading-relaxed text-foreground">{post.caption}</p>

        <FeedPostComments
          postId={post.id}
          commentsCount={commentsCount}
          onCommentsCountChange={(count) => {
            setCommentsCount(count)
            onCommentsCountChange(post.id, count)
          }}
        />
      </div>
    </article>
  )
}
