'use client'

import { ChevronRight } from 'lucide-react'
import { usePassportStories } from '@/hooks/use-passport-stories'
import { useOwnerDisplayAvatar } from '@/hooks/use-owner-display-avatar'
import { PassportStoryCarousel } from '@/components/passport/passport-story-viewer'
import { cn } from '@/lib/utils'

interface PassportStoriesPublicStripProps {
  ownerId: string
  displayName: string
  avatarUrl?: string | null
  className?: string
}

export function PassportStoriesPublicStrip({
  ownerId,
  displayName,
  avatarUrl,
  className,
}: PassportStoriesPublicStripProps) {
  const { stories, loading } = usePassportStories(ownerId)
  const resolvedAvatarUrl = useOwnerDisplayAvatar(ownerId, avatarUrl)

  if (loading || stories.length === 0) return null

  return (
    <section className={cn('rounded-2xl border border-stone-200/80 bg-white/80 p-4 backdrop-blur-sm', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-harvest-700">Stories</p>
          <h3 className="text-sm font-semibold text-foreground">See what {displayName} is sharing</h3>
        </div>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
          Swipe
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <PassportStoryCarousel
        ownerId={ownerId}
        displayName={displayName}
        avatarUrl={resolvedAvatarUrl}
        stories={stories}
      />
    </section>
  )
}
