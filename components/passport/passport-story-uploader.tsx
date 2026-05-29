'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Trash2, Upload, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { uploadPassportStoryMedia } from '@/lib/passport-stories/upload'
import {
  defaultStoryKindForRole,
  storyKindLabel,
  type PassportStoryView,
} from '@/lib/passport-stories/stories'
import {
  enforceMarketPromoRules,
  missingLocationHint,
  type MarketPromoContext,
} from '@/lib/passport-stories/promo-validation'
import type { PassportStoryKind, Role } from '@/types/database'
import { PASSPORT_STORY_MAX_COUNT } from '@/lib/passport-stories/media'
import { resolvePublicAssetUrl } from '@/lib/storage/public-url'

interface PassportStoryUploaderProps {
  ownerId: string
  role: Role
  stories: PassportStoryView[]
  onStoriesChange: (stories: PassportStoryView[]) => void
  className?: string
}

interface PendingItem {
  /** Local-only id so we can remove a single queued file before publish. */
  id: string
  file: File
  previewUrl: string
  type: 'image' | 'video'
}

interface CoordinatorMarketRow {
  id: string
  name: string
  locationName: string | null
  address: string | null
  city: string | null
}

function makePendingId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function PassportStoryUploader({
  ownerId,
  role,
  stories,
  onStoriesChange,
  className,
}: PassportStoryUploaderProps) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')
  const [storyKind, setStoryKind] = useState<PassportStoryKind>(defaultStoryKindForRole(role))
  // Multi-file queue. Each entry is one in-flight upload candidate; the
  // coordinator can stage many at once and the publish flow loops through
  // them, creating one passport story per file.
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Coordinator-only market picker. Only loaded when the role is
  // `coordinator` so vendors / shoppers don't pay for the round trip.
  const [coordinatorMarkets, setCoordinatorMarkets] = useState<CoordinatorMarketRow[]>([])
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null)

  const remainingSlots = Math.max(0, PASSPORT_STORY_MAX_COUNT - stories.length)
  const atLimit = remainingSlots === 0
  const queuedCount = pendingItems.length
  const queueFull = queuedCount >= remainingSlots
  const hasPending = queuedCount > 0
  const isCoordinatorPromo = role === 'coordinator' && storyKind === 'market_promo'

  useEffect(() => {
    if (role !== 'coordinator') return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('events')
        .select('id, name, location_name, address, market_city, status')
        .eq('coordinator_id', ownerId)
        .order('start_at', { ascending: false })
        .limit(50)
      if (cancelled) return
      const rows: CoordinatorMarketRow[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ''),
        name: String(row.name ?? '').trim() || 'Untitled market',
        locationName: (row.location_name as string | null) ?? null,
        address: (row.address as string | null) ?? null,
        city: (row.market_city as string | null) ?? null,
      })).filter((r) => r.id)
      setCoordinatorMarkets(rows)
      // Auto-pick the most recent market so the picker isn't an extra click.
      setSelectedMarketId((current) => current ?? rows[0]?.id ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [ownerId, role, supabase])

  const resetPending = useCallback(() => {
    setPendingItems((prev) => {
      for (const item of prev) URL.revokeObjectURL(item.previewUrl)
      return []
    })
    setCaption('')
  }, [])

  // Revoke any object URLs still hanging around when the component
  // unmounts so we don't leak preview blobs.
  useEffect(() => {
    return () => {
      setPendingItems((prev) => {
        for (const item of prev) URL.revokeObjectURL(item.previewUrl)
        return []
      })
    }
  }, [])

  const queueFiles = useCallback(
    (incoming: FileList | File[] | null) => {
      if (!incoming) return
      const arr = Array.from(incoming).filter(Boolean) as File[]
      if (arr.length === 0) return
      setPendingItems((prev) => {
        const headroom = Math.max(0, remainingSlots - prev.length)
        if (headroom === 0) {
          toast.error(`You can only publish ${PASSPORT_STORY_MAX_COUNT} stories total.`)
          return prev
        }
        const accepted = arr.slice(0, headroom)
        if (accepted.length < arr.length) {
          toast.warning(
            `Only added ${accepted.length} of ${arr.length} files — story limit is ${PASSPORT_STORY_MAX_COUNT}.`
          )
        }
        const next = accepted.map<PendingItem>((file) => ({
          id: makePendingId(),
          file,
          previewUrl: URL.createObjectURL(file),
          type: file.type.startsWith('video/') ? 'video' : 'image',
        }))
        return [...prev, ...next]
      })
    },
    [remainingSlots]
  )

  const removePending = useCallback((id: string) => {
    setPendingItems((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
  }, [])

  async function handlePublish() {
    if (pendingItems.length === 0 || uploading) return

    let captionToPersist = caption.trim() || null
    let promoToastMessage: string | null = null

    if (isCoordinatorPromo) {
      const market = coordinatorMarkets.find((m) => m.id === selectedMarketId)
      if (!market) {
        toast.error(
          coordinatorMarkets.length === 0
            ? "You don't have any markets yet — create one before posting a market promo."
            : 'Pick which market this promo is for before publishing.'
        )
        return
      }
      const ctx: MarketPromoContext = {
        name: market.name,
        locationName: market.locationName,
        address: market.address,
        city: market.city,
      }
      const result = enforceMarketPromoRules(captionToPersist, ctx)
      if (result.missingLocation) {
        toast.error(missingLocationHint(ctx))
        return
      }
      captionToPersist = result.caption
      if (result.hashtagAppended) {
        promoToastMessage = `Added ${result.hashtag} so patrons can find ${market.name}.`
        // Reflect the auto-appended hashtag in the caption box too so the
        // coordinator can see what we saved.
        setCaption(result.caption)
      }
    }

    setUploading(true)
    const published: PassportStoryView[] = []
    const failures: string[] = []
    const succeededIndices = new Set<number>()

    try {
      for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i]!
        try {
          const uploaded = await uploadPassportStoryMedia(supabase, {
            ownerId,
            file: item.file,
          })
          const res = await fetch('/api/passport/stories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mediaUrl: uploaded.mediaUrl,
              mediaType: uploaded.mediaType,
              durationSeconds: uploaded.durationSeconds,
              storyKind,
              caption: captionToPersist,
            }),
          })
          const json = (await res.json()) as { story?: PassportStoryView; error?: string }
          if (!res.ok || !json.story) {
            failures.push(json.error ?? `Could not publish ${item.file.name}`)
            continue
          }
          published.push(json.story)
          succeededIndices.add(i)
        } catch (err) {
          failures.push(
            err instanceof Error
              ? `${item.file.name}: ${err.message}`
              : `Upload failed for ${item.file.name}`
          )
        }
      }

      if (published.length > 0) {
        onStoriesChange([...stories, ...published])
        if (promoToastMessage) toast.info(promoToastMessage)
        toast.success(
          published.length === 1
            ? 'Story published to your passport'
            : `Published ${published.length} stories to your passport`
        )
      }

      // Drop succeeded items from the queue (revoking their preview URLs);
      // keep failures in place so the coordinator can retry them without
      // re-selecting from disk. If everything succeeded we also clear the
      // caption so the form returns to a fresh state.
      setPendingItems((prev) => {
        const remaining: PendingItem[] = []
        prev.forEach((item, idx) => {
          if (succeededIndices.has(idx)) {
            URL.revokeObjectURL(item.previewUrl)
          } else {
            remaining.push(item)
          }
        })
        return remaining
      })
      if (failures.length === 0 && published.length > 0) {
        setCaption('')
      }

      if (failures.length > 0) {
        toast.error(failures[0]!)
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove(storyId: string) {
    setRemovingId(storyId)
    try {
      const res = await fetch(`/api/passport/stories/${storyId}`, { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? 'Could not remove story')
        return
      }
      onStoriesChange(stories.filter((s) => s.id !== storyId))
      toast.success('Story removed')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className={cn('space-y-4 rounded-2xl border bg-white p-5', className)}>
      <div>
        <h3 className="font-semibold text-foreground">Passport stories</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload up to 30-second clips or photos — patrons see them on your public passport like
          Instagram stories. You can pick several files at once.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        className="sr-only"
        onChange={(e) => {
          queueFiles(e.target.files)
          // Reset the input so re-selecting the same files re-triggers onChange.
          if (e.target) e.target.value = ''
        }}
      />

      {!hasPending ? (
        <button
          type="button"
          disabled={atLimit || uploading}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            queueFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition-colors',
            dragOver
              ? 'border-harvest-400 bg-harvest-50/60'
              : 'border-stone-200 hover:border-harvest-300 hover:bg-canvas',
            atLimit && 'cursor-not-allowed opacity-60'
          )}
        >
          <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium text-foreground">
            {atLimit ? 'Story limit reached' : 'Drop clips or tap to upload (multi-select OK)'}
          </span>
          <span className="text-xs text-muted-foreground">MP4/WebM or JPEG/PNG · max 30 seconds each</span>
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border bg-canvas p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {queuedCount === 1 ? '1 file ready' : `${queuedCount} files ready`} to publish
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || queueFull}
                onClick={() => inputRef.current?.click()}
              >
                Add more
              </Button>
            </div>
          </div>

          <ul
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
          >
            {pendingItems.map((item) => (
              <li
                key={item.id}
                className="relative overflow-hidden rounded-lg border bg-stone-950 shadow-sm"
              >
                {item.type === 'video' ? (
                  <video
                    src={item.previewUrl}
                    muted
                    playsInline
                    className="h-32 w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-32 w-full object-cover"
                  />
                )}
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => removePending(item.id)}
                  className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-stone-900/80 text-white hover:bg-stone-900"
                  aria-label={`Remove ${item.file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <p className="break-words whitespace-pre-wrap w-full bg-stone-900/85 px-2 py-1 text-[11px] text-white">
                  {item.file.name}
                </p>
              </li>
            ))}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Story type</Label>
              <Select value={storyKind} onValueChange={(v) => setStoryKind(v as PassportStoryKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {role === 'vendor' ? (
                    <SelectItem value="behind_the_brand">Behind the Brand</SelectItem>
                  ) : null}
                  {role === 'coordinator' ? (
                    <SelectItem value="market_promo">Market Promo</SelectItem>
                  ) : null}
                  <SelectItem value="story">General story</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCoordinatorPromo ? (
              <div className="space-y-1.5">
                <Label htmlFor="story-market">Promo for which market?</Label>
                {coordinatorMarkets.length === 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Create a market first — promos need a market to tag.
                  </p>
                ) : (
                  <Select
                    value={selectedMarketId ?? ''}
                    onValueChange={(v) => setSelectedMarketId(v)}
                  >
                    <SelectTrigger id="story-market">
                      <SelectValue placeholder="Pick a market" />
                    </SelectTrigger>
                    <SelectContent>
                      {coordinatorMarkets.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                          {m.locationName ? ` · ${m.locationName}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : null}

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="story-caption">
                Caption{isCoordinatorPromo ? ' (must mention the venue or city)' : ' (optional)'}
              </Label>
              <Textarea
                id="story-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder={
                  isCoordinatorPromo
                    ? 'Where, when, who. We auto-add #MarketName if you forget.'
                    : 'What should patrons know?'
                }
              />
              {isCoordinatorPromo ? (
                <p className="text-[11px] text-muted-foreground">
                  Same caption applies to every queued file.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={uploading} onClick={() => void handlePublish()}>
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {queuedCount > 1 ? `Publish ${queuedCount} stories` : 'Publish story'}
            </Button>
            <Button type="button" variant="outline" disabled={uploading} onClick={resetPending}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {stories.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {stories.map((story) => (
            <li
              key={story.id}
              className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-harvest-400">
                {story.mediaType === 'video' ? (
                  <div className="flex h-full w-full items-center justify-center bg-stone-900">
                    <Video className="h-5 w-5 text-white" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolvePublicAssetUrl(story.mediaUrl, 'market-feed') ?? story.mediaUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {/*
                  Mobile fix: drop `truncate` (which sets white-space: nowrap +
                  overflow: hidden) so the "Market Promo" label and its caption
                  wrap inside the card on narrow viewports instead of clipping
                  past the right edge. break-words + whitespace-pre-wrap +
                  w-full are the spec'd responsive trio.
                */}
                <p className="break-words whitespace-pre-wrap w-full text-sm font-medium">
                  {storyKindLabel(story.storyKind)}
                </p>
                <p className="break-words whitespace-pre-wrap w-full text-xs text-muted-foreground">
                  {story.caption || (story.mediaType === 'video' ? 'Video clip' : 'Photo')}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                disabled={removingId === story.id}
                aria-label="Remove story"
                onClick={() => void handleRemove(story.id)}
              >
                {removingId === story.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No stories published yet.</p>
      )}
    </div>
  )
}
