'use client'

import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  buildEventCalendarPayload,
  downloadIcsFile,
} from '@/lib/shopper/calendar-export'
import { cn } from '@/lib/utils'
import type { Event } from '@/types/database'
import type { ComponentProps } from 'react'

interface AddToCalendarButtonProps {
  event: Event
  selectedDate?: Date
  className?: string
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  /** @deprecated Use labelVisibility instead */
  showLabel?: boolean
  labelVisibility?: 'always' | 'mobile' | 'never'
}

export function AddToCalendarButton({
  event,
  selectedDate,
  className,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
  labelVisibility,
}: AddToCalendarButtonProps) {
  const visibility = labelVisibility ?? (showLabel ? 'always' : 'never')

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn('min-h-11 gap-1.5 touch-manipulation', className)}
      onClick={() =>
        downloadIcsFile(buildEventCalendarPayload(event, selectedDate), 'market-event.ics')
      }
    >
      <CalendarPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {visibility === 'always' ? <span>Add to Calendar</span> : null}
      {visibility === 'mobile' ? (
        <span className="sm:hidden">Add to Calendar</span>
      ) : null}
      {visibility === 'never' ? <span className="sr-only">Add to Calendar</span> : null}
    </Button>
  )
}
