'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Volume2, VolumeX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { storyKindLabel, type PassportStoryView } from '@/lib/passport-stories/stories'
import {
  resolveStoryBackground,
  resolveStoryVideoPoster,
  resolveStoryVideoSrc,
  storyBackgroundClassName,
} from '@/lib/passport-stories/story-media'
import { resolveAnyPublicAssetUrl } from '@/lib/storage/public-url'
import { useOwnerBrandLogo } from '@/hooks/use-owner-brand-logo'

const DEFAULT_IMAGE_DURATION_MS = 5000

interface PassportStoryViewerProps {
  stories: PassportStoryView[]
  initialIndex?: number
  displayName: string
  avatarUrl?: string | null
  open: boolean
  onClose: () => void
}

export function PassportStoryViewer({
  stories,
  initialIndex = 0,
  displayName,
  avatarUrl,
  open,
  onClose,
}: PassportStoryViewerProps) {
  const [index, setIndex] = useState(initialIndex)
  const [progress, setProgress] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const durationMsRef = useRef(DEFAULT_IMAGE_DURATION_MS)

  const story = stories[index]
  const logoUrl = useOwnerBrandLogo(story?.ownerId ?? stories[0]?.ownerId ?? '')

  const touchStartX = useRef<number | null>(null)

  const goNext = useCallback(() => {
    setProgress(0)
    setIsLoading(true)
    if (index >= stories.length - 1) {
      onClose()
      return
    }
    setIndex((i) => i + 1)
  }, [index, onClose, stories.length])

  const goPrev = useCallback(() => {
    setProgress(0)
    setIsLoading(true)
    if (index <= 0) return
    setIndex((i) => i - 1)
  }, [index])

  useEffect(() => {
    if (open) {
      setIndex(initialIndex)
      setProgress(0)
      setIsLoading(true)
      setIsPaused(false)
    }
  }, [open, initialIndex])

  useEffect(() => {
    if (!open || !story) return

    if (story.mediaType === 'image') {
      durationMsRef.current = DEFAULT_IMAGE_DURATION_MS
      setIsLoading(false)
      startedAtRef.current = performance.now()

      if (isPaused) return

      const tick = () => {
        const elapsed = performance.now() - startedAtRef.current
        const pct = Math.min(100, (elapsed / durationMsRef.current) * 100)
        setProgress(pct)
        if (pct >= 100) {
          goNext()
          return
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      }
    }

    const video = videoRef.current
    if (!video) return

    setIsLoading(true)
    video.currentTime = 0
    void video.play().catch(() => {})

    return () => {
      video.pause()
    }
  }, [open, story, index, isPaused, goNext])

  function handleVideoLoaded() {
    const video = videoRef.current
    if (!video) return
    durationMsRef.current =
      story.mediaType === 'video' && story.durationSeconds
        ? story.durationSeconds * 1000
        : (video.duration || 15) * 1000
    setIsLoading(false)
    startedAtRef.current = performance.now()
  }

  function handleVideoTimeUpdate() {
    const video = videoRef.current
    if (!video || !video.duration) return
    setProgress((video.currentTime / video.duration) * 100)
  }

  function handleVideoEnded() {
    goNext()
  }

  function handleTapZone(clientX: number, width: number) {
    const third = width / 3
    if (clientX < third) {
      goPrev()
    } else if (clientX > third * 2) {
      goNext()
    } else {
      setIsPaused((p) => {
        const next = !p
        const video = videoRef.current
        if (video) {
          if (next) video.pause()
          else void video.play().catch(() => {})
        }
        return next
      })
    }
  }

  if (!open || !story) return null

  const resolvedAvatarSrc = resolveAnyPublicAssetUrl(avatarUrl)
  const storyBg =
    story.mediaType === 'image' ? resolveStoryBackground(story, logoUrl) : null
  const videoPoster = resolveStoryVideoPoster(logoUrl)

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black"
      role="dialog"
      aria-label={`${displayName} stories`}
    >
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pt-3 safe-top">
        {stories.map((s, i) => (
          <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full bg-gradient-to-r from-harvest-300 via-white to-sage-200 transition-[width] duration-100 ease-linear"
              style={{
                width:
                  i < index ? '100%' : i === index ? `${progress}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-3 pt-8">
        <div className="flex min-w-0 items-center gap-2">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedAvatarSrc ?? avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full border border-white/40 object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="text-[10px] text-white/70">{storyKindLabel(story.storyKind)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {story.mediaType === 'video' ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              onClick={() => {
                setIsMuted((m) => {
                  const next = !m
                  if (videoRef.current) videoRef.current.muted = next
                  return next
                })
              }}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            aria-label="Close stories"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => handleTapZone(e.clientX, e.currentTarget.clientWidth)}
        onTouchStart={(e) => {
          touchStartX.current = e.changedTouches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current
          const end = e.changedTouches[0]?.clientX
          touchStartX.current = null
          if (start == null || end == null) return
          const delta = end - start
          if (Math.abs(delta) < 48) return
          if (delta < 0) goNext()
          else goPrev()
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') goPrev()
          if (e.key === 'ArrowRight') goNext()
          if (e.key === 'Escape') onClose()
        }}
        role="button"
        tabIndex={0}
      >
        {story.mediaType === 'video' ? (
          <video
            ref={videoRef}
            key={story.id}
            src={resolveStoryVideoSrc(story)}
            poster={videoPoster}
            className="max-h-full max-w-full object-contain"
            playsInline
            muted={isMuted}
            preload="auto"
            onLoadedData={handleVideoLoaded}
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleVideoEnded}
            onWaiting={() => setIsLoading(true)}
            onCanPlay={() => setIsLoading(false)}
          />
        ) : storyBg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={story.id}
            src={storyBg.url}
            alt=""
            className={storyBackgroundClassName(storyBg.source, 'full')}
            onLoad={() => setIsLoading(false)}
          />
        ) : null}

        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          </div>
        ) : null}

        {isPaused ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
              Paused
            </span>
          </div>
        ) : null}
      </div>

      {story.caption ? (
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-12">
          <p className="text-sm leading-relaxed text-white">{story.caption}</p>
        </div>
      ) : null}

      <p className="pointer-events-none absolute inset-x-0 bottom-[max(3.5rem,env(safe-area-inset-bottom))] z-10 text-center text-[10px] font-medium uppercase tracking-widest text-white/40">
        Swipe for next story
      </p>
    </div>
  )
}

interface PassportStoryCarouselProps {
  ownerId: string
  displayName: string
  avatarUrl?: string | null
  stories: PassportStoryView[]
  className?: string
}

export function PassportStoryCarousel({
  ownerId,
  displayName,
  avatarUrl,
  stories,
  className,
}: PassportStoryCarouselProps) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [startIndex, setStartIndex] = useState(0)
  const logoUrl = useOwnerBrandLogo(ownerId)

  if (stories.length === 0) return null

  const resolvedRingAvatar = resolveAnyPublicAssetUrl(avatarUrl)

  return (
    <>
      <div className={cn('flex items-center gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-pl-1', className)}>
        <button
          type="button"
          className="group flex shrink-0 snap-start flex-col items-center gap-2 touch-manipulation"
          onClick={() => {
            setStartIndex(0)
            setViewerOpen(true)
          }}
        >
          <div
            className={cn(
              'rounded-full p-[3px]',
              'bg-gradient-to-tr from-forest via-harvest-400 to-amber-300 shadow-[0_4px_20px_rgb(45_90_39_/_0.25)]'
            )}
          >
            <div className="rounded-full bg-white p-[2px]">
              {resolvedRingAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolvedRingAvatar}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover sm:h-[4.5rem] sm:w-[4.5rem]"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-harvest-100 text-base font-bold text-harvest-800 sm:h-[4.5rem] sm:w-[4.5rem]">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <span className="max-w-[80px] truncate text-xs font-semibold text-foreground">
            Stories
          </span>
        </button>

        {stories.map((story, i) => {
          const storyBg =
            story.mediaType === 'image' ? resolveStoryBackground(story, logoUrl) : null

          return (
          <button
            key={story.id}
            type="button"
            className="group flex shrink-0 snap-start flex-col items-center gap-2 touch-manipulation"
            onClick={() => {
              setStartIndex(i)
              setViewerOpen(true)
            }}
          >
            <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-stone-200 transition group-hover:ring-harvest-400 group-active:scale-95 sm:h-[4.5rem] sm:w-[4.5rem]">
              {story.mediaType === 'video' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveStoryVideoPoster(logoUrl)}
                  alt=""
                  className={storyBackgroundClassName('logo', 'thumb')}
                />
              ) : storyBg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={storyBg.url}
                  alt=""
                  className={storyBackgroundClassName(storyBg.source, 'thumb')}
                />
              ) : null}
            </div>
            <span className="max-w-[80px] truncate text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
              {storyKindLabel(story.storyKind)}
            </span>
          </button>
          )
        })}
      </div>

      <PassportStoryViewer
        stories={stories}
        initialIndex={startIndex}
        displayName={displayName}
        avatarUrl={avatarUrl}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  )
}
