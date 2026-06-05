import { resolvePublicAssetUrl } from '@/lib/storage/public-url'
import type { PassportStoryView } from '@/lib/passport-stories/stories'
import { cn } from '@/lib/utils'

export const PASSPORT_STORY_PLACEHOLDER_LOGO = '/placeholder-logo.png'

export type StoryMediaSource = 'media' | 'logo' | 'placeholder'

export interface ResolvedStoryBackground {
  url: string
  source: StoryMediaSource
}

/** Image backdrop for story cards: story photo → brand logo → placeholder. */
export function resolveStoryBackground(
  story: PassportStoryView,
  logoUrl: string | null | undefined
): ResolvedStoryBackground {
  const storyImageUrl =
    story.mediaType === 'image' && story.mediaUrl.trim()
      ? resolvePublicAssetUrl(story.mediaUrl, 'market-feed') ?? story.mediaUrl
      : null

  const storyBg = storyImageUrl || logoUrl || PASSPORT_STORY_PLACEHOLDER_LOGO

  const source: StoryMediaSource = storyImageUrl
    ? 'media'
    : logoUrl
      ? 'logo'
      : 'placeholder'

  return { url: storyBg, source }
}

/** Poster frame for video stories while the clip loads. */
export function resolveStoryVideoPoster(logoUrl: string | null | undefined): string {
  return logoUrl || PASSPORT_STORY_PLACEHOLDER_LOGO
}

export function resolveStoryVideoSrc(story: PassportStoryView): string {
  return resolvePublicAssetUrl(story.mediaUrl, 'market-feed') ?? story.mediaUrl
}

export function storyBackgroundClassName(
  source: StoryMediaSource,
  variant: 'thumb' | 'full' = 'thumb'
): string {
  const isLogoFallback = source === 'logo' || source === 'placeholder'
  return cn(
    variant === 'thumb' ? 'h-full w-full' : 'max-h-full max-w-full w-full',
    isLogoFallback
      ? 'object-contain bg-neutral-900 p-4'
      : variant === 'thumb'
        ? 'object-contain bg-gray-50'
        : 'object-contain bg-gray-50'
  )
}
