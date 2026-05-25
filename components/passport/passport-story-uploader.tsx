'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Trash2, Upload, Video } from 'lucide-react'
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const atLimit = stories.length >= PASSPORT_STORY_MAX_COUNT

  const resetPending = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPendingFile(null)
    setCaption('')
  }, [previewUrl])

  function handleFile(file: File | null) {
    if (!file) return
    resetPending()
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handlePublish() {
    if (!pendingFile || uploading) return
    setUploading(true)
    try {
      const uploaded = await uploadPassportStoryMedia(supabase, {
        ownerId,
        file: pendingFile,
      })

      const res = await fetch('/api/passport/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaUrl: uploaded.mediaUrl,
          mediaType: uploaded.mediaType,
          durationSeconds: uploaded.durationSeconds,
          storyKind,
          caption: caption.trim() || null,
        }),
      })

      const json = (await res.json()) as { story?: PassportStoryView; error?: string }
      if (!res.ok) {
        toast.error(json.error ?? 'Could not publish story')
        return
      }

      if (json.story) {
        onStoriesChange([...stories, json.story])
      }
      toast.success('Story published to your passport')
      resetPending()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
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
          Instagram stories.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {!pendingFile ? (
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
            handleFile(e.dataTransfer.files?.[0] ?? null)
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
            {atLimit ? 'Story limit reached' : 'Drop a clip or tap to upload'}
          </span>
          <span className="text-xs text-muted-foreground">MP4/WebM or JPEG/PNG · max 30 seconds</span>
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border bg-canvas p-4">
          <div className="overflow-hidden rounded-lg bg-stone-950">
            {pendingFile.type.startsWith('video/') ? (
              <video src={previewUrl ?? undefined} controls className="max-h-48 w-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl ?? undefined} alt="" className="max-h-48 w-full object-cover" />
            )}
          </div>

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
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="story-caption">Caption (optional)</Label>
              <Textarea
                id="story-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="What should patrons know?"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={uploading} onClick={() => void handlePublish()}>
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Publish story
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
              className="flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm"
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
                <p className="truncate text-sm font-medium">{storyKindLabel(story.storyKind)}</p>
                <p className="truncate text-xs text-muted-foreground">
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
