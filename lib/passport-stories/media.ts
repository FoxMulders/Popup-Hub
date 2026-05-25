const MAX_VIDEO_DURATION_SEC = 30

const VIDEO_TYPES = new Set(['video/mp4', 'video/webm'])
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type PassportStoryMediaType = 'video' | 'image'

export function passportStoryMediaTypeFromMime(mime: string): PassportStoryMediaType | null {
  if (IMAGE_TYPES.has(mime)) return 'image'
  if (VIDEO_TYPES.has(mime)) return 'video'
  return null
}

/** Validates clip length before upload (max 30 seconds). */
export function validateStoryVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      if (!Number.isFinite(video.duration)) {
        resolve(null)
        return
      }
      if (video.duration > MAX_VIDEO_DURATION_SEC + 0.25) {
        resolve(null)
        return
      }
      resolve(Math.round(video.duration * 100) / 100)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}

export function getStoryVideoDurationError(): string {
  return 'Video clips must be 30 seconds or shorter.'
}

export const PASSPORT_STORY_MAX_COUNT = 12
export const PASSPORT_STORY_MAX_VIDEO_BYTES = 15 * 1024 * 1024
export const PASSPORT_STORY_MAX_IMAGE_BYTES = 5 * 1024 * 1024
