'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CommandCenterExitLink({
  eventId,
  eventName,
  className,
  compact = false,
}: {
  eventId: string
  eventName?: string | null
  className?: string
  /** Smaller label for side rails */
  compact?: boolean
}) {
  const label = eventName?.trim()
    ? compact
      ? 'Event overview'
      : `Back to ${eventName.trim()}`
    : 'Event overview'

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn(
        'gap-1.5 text-stone-700 hover:text-forest',
        compact && 'h-8 px-2 text-xs',
        className
      )}
    >
      <Link href={`/coordinator/events/${eventId}`}>
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </Link>
    </Button>
  )
}
