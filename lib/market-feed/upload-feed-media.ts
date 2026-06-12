import type { SupabaseClient } from '@supabase/supabase-js'
import { compressImageForUpload } from '@/lib/media/compress-image-for-upload'
import type { MarketFeedMediaType } from '@/types/database'

const MARKET_FEED_BUCKET = 'market-feed'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_VIDEO_BYTES = 15 * 1024 * 1024
const MAX_VIDEO_DURATION_SEC = 30

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm'])

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function mediaTypeFromMime(mime: string): MarketFeedMediaType | null {
  if (IMAGE_TYPES.has(mime)) return 'image'
  if (VIDEO_TYPES.has(mime)) return 'video'
  return null
}

/** Validates client-side video duration before upload. */
export function validateFeedVideoDuration(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(video.duration <= MAX_VIDEO_DURATION_SEC + 0.25)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(false)
    }
    video.src = url
  })
}

export async function uploadMarketFeedMedia(
  supabase: SupabaseClient,
  input: {
    vendorId: string
    eventId: string
    file: File
  }
): Promise<{ mediaUrl: string; mediaType: MarketFeedMediaType }> {
  const mediaType = mediaTypeFromMime(input.file.type)
  if (!mediaType) {
    throw new Error('Upload a JPEG, PNG, WebP image or MP4/WebM video clip.')
  }

  const file =
    mediaType === 'image'
      ? await compressImageForUpload(input.file, MAX_IMAGE_BYTES)
      : input.file

  if (mediaType === 'image' && file.size > MAX_IMAGE_BYTES) {
    throw new Error('Images must be 5 MB or smaller. Try a smaller photo or crop before uploading.')
  }

  if (mediaType === 'video') {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error('Video clips must be 15 MB or smaller.')
    }
    const durationOk = await validateFeedVideoDuration(file)
    if (!durationOk) {
      throw new Error('Video clips must be 30 seconds or shorter.')
    }
  }

  const ext = file.name.includes('.')
    ? file.name.split('.').pop()!.toLowerCase()
    : mediaType === 'video'
      ? 'mp4'
      : 'jpg'

  const path = `${input.vendorId}/${input.eventId}/feed-${Date.now()}-${sanitizeFileName(file.name || `clip.${ext}`)}`

  const { error } = await supabase.storage.from(MARKET_FEED_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data } = supabase.storage.from(MARKET_FEED_BUCKET).getPublicUrl(path)
  return { mediaUrl: data.publicUrl, mediaType }
}
