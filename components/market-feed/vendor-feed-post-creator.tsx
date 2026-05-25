'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Upload, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TouchFileInput } from '@/components/ui/touch-file-input'
import { toast } from 'sonner'
import { uploadMarketFeedMedia } from '@/lib/market-feed/upload-feed-media'
import type { MarketFeedMediaType } from '@/types/database'

interface VendorFeedPostCreatorProps {
  eventId: string
  eventName: string
  vendorId: string
  onPosted?: () => void
}

export function VendorFeedPostCreator({
  eventId,
  eventName,
  vendorId,
  onPosted,
}: VendorFeedPostCreatorProps) {
  const supabase = createClient()
  const [caption, setCaption] = useState('')
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<MarketFeedMediaType | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleFileSelect(file: File | null) {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview)
    setSelectedFile(file)
    if (!file) {
      setMediaPreview(null)
      setMediaType(null)
      return
    }
    const isVideo = file.type.startsWith('video/')
    setMediaType(isVideo ? 'video' : 'image')
    setMediaPreview(URL.createObjectURL(file))
  }

  async function handlePublish() {
    if (!selectedFile || !mediaType || !caption.trim()) {
      toast.error('Add a photo or video clip and write your maker story.')
      return
    }
    if (submitting) return

    setSubmitting(true)
    try {
      setUploading(true)
      const { mediaUrl, mediaType: resolvedType } = await uploadMarketFeedMedia(supabase, {
        vendorId,
        eventId,
        file: selectedFile,
      })
      setUploading(false)

      const res = await fetch(`/api/markets/${eventId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaUrl,
          mediaType: resolvedType,
          caption: caption.trim(),
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? 'Could not publish story')
        return
      }

      toast.success('Your maker story is live!')
      setCaption('')
      handleFileSelect(null)
      onPosted?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish story')
    } finally {
      setUploading(false)
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Share a maker spotlight</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Post a product photo or 30-second story clip for checked-in patrons at {eventName}.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Photo or video clip</Label>
        <TouchFileInput
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          label="Tap to choose a photo or video clip"
          onChange={(files) => handleFileSelect(files?.[0] ?? null)}
        />
        {mediaPreview ? (
          <div className="overflow-hidden rounded-xl border bg-stone-950">
            {mediaType === 'video' ? (
              <video src={mediaPreview} controls className="max-h-48 w-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaPreview} alt="" className="max-h-48 w-full object-cover" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            <Video className="h-4 w-4 shrink-0" />
            JPEG, PNG, WebP, or MP4/WebM up to 30 seconds
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`feed-caption-${eventId}`}>Story caption</Label>
        <Textarea
          id={`feed-caption-${eventId}`}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Tell patrons about your craft, today's special, or an auction item…"
          rows={4}
          maxLength={1000}
        />
      </div>

      <Button
        type="button"
        className="w-full gap-1.5"
        disabled={submitting || !selectedFile || !caption.trim()}
        onClick={() => void handlePublish()}
      >
        {uploading || submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploading ? 'Uploading…' : submitting ? 'Publishing…' : 'Publish to live feed'}
      </Button>
    </div>
  )
}
