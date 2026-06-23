'use client'

import type { Role } from '@/types/database'
import { PassportStoryUploader } from '@/components/passport/passport-story-uploader'
import { usePassportStories } from '@/hooks/use-passport-stories'
import { Loader2 } from 'lucide-react'

interface PassportStoriesManagerProps {
  ownerId: string
  role: Role
}

export function PassportStoriesManager({ ownerId, role }: PassportStoriesManagerProps) {
  const { stories, setStories, loading, error } = usePassportStories(ownerId)

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-stone-200/80 marketing-glass-card px-4 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-harvest-600" />
        Loading stories…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-white px-4 py-6 text-sm text-destructive">{error}</div>
    )
  }

  return (
    <PassportStoryUploader
      ownerId={ownerId}
      role={role}
      stories={stories}
      onStoriesChange={setStories}
    />
  )
}
