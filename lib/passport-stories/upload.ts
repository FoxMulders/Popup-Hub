import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PASSPORT_STORY_MAX_IMAGE_BYTES,
  PASSPORT_STORY_MAX_VIDEO_BYTES,
  passportStoryMediaTypeFromMime,
  validateStoryVideoDuration,
  getStoryVideoDurationError,
  type PassportStoryMediaType,
} from '@/lib/passport-stories/media'

const STORY_BUCKET = 'market-feed'

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function uploadPassportStoryMedia(
  supabase: SupabaseClient,
  input: {
    ownerId: string
    file: File
  }
): Promise<{ mediaUrl: string; mediaType: PassportStoryMediaType; durationSeconds: number | null }> {
  const mediaType = passportStoryMediaTypeFromMime(input.file.type)
  if (!mediaType) {
    throw new Error('Upload a JPEG, PNG, WebP image or MP4/WebM video clip.')
  }

  if (mediaType === 'image' && input.file.size > PASSPORT_STORY_MAX_IMAGE_BYTES) {
    throw new Error('Images must be 5 MB or smaller.')
  }

  let durationSeconds: number | null = null
  if (mediaType === 'video') {
    if (input.file.size > PASSPORT_STORY_MAX_VIDEO_BYTES) {
      throw new Error('Video clips must be 15 MB or smaller.')
    }
    durationSeconds = await validateStoryVideoDuration(input.file)
    if (durationSeconds == null) {
      throw new Error(getStoryVideoDurationError())
    }
  }

  const ext = input.file.name.includes('.')
    ? input.file.name.split('.').pop()!.toLowerCase()
    : mediaType === 'video'
      ? 'mp4'
      : 'jpg'

  const path = `${input.ownerId}/passport-stories/story-${Date.now()}-${sanitizeFileName(input.file.name || `clip.${ext}`)}`

  const { error } = await supabase.storage.from(STORY_BUCKET).upload(path, input.file, {
    upsert: false,
    contentType: input.file.type || undefined,
  })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data } = supabase.storage.from(STORY_BUCKET).getPublicUrl(path)
  return { mediaUrl: data.publicUrl, mediaType, durationSeconds }
}
