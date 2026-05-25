'use client'

import { usePassportStories } from '@/hooks/use-passport-stories'
import { useOwnerDisplayAvatar } from '@/hooks/use-owner-display-avatar'
import { PassportStoryCarousel } from '@/components/passport/passport-story-viewer'

interface PassportStoriesPublicStripProps {
  ownerId: string
  displayName: string
  avatarUrl?: string | null
}

export function PassportStoriesPublicStrip({
  ownerId,
  displayName,
  avatarUrl,
}: PassportStoriesPublicStripProps) {
  const { stories, loading } = usePassportStories(ownerId)
  const resolvedAvatarUrl = useOwnerDisplayAvatar(ownerId, avatarUrl)

  if (loading || stories.length === 0) return null

  return (
    <PassportStoryCarousel
      ownerId={ownerId}
      displayName={displayName}
      avatarUrl={resolvedAvatarUrl}
      stories={stories}
      className="px-1"
    />
  )
}
