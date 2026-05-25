'use client'

import { PassportStoriesPublicStrip } from '@/components/passport/passport-stories-public-strip'

interface CoordinatorStoriesStripProps {
  coordinatorId: string
  displayName: string
  avatarUrl?: string | null
}

export function CoordinatorStoriesStrip({
  coordinatorId,
  displayName,
  avatarUrl,
}: CoordinatorStoriesStripProps) {
  return (
    <PassportStoriesPublicStrip
      ownerId={coordinatorId}
      displayName={displayName}
      avatarUrl={avatarUrl}
    />
  )
}
