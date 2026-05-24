'use client'

import { format, isWithinInterval } from 'date-fns'
import { CalendarPlus } from 'lucide-react'
import type { EventScheduleItem } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { marketStatusBadge } from '@/lib/theme/market'
import { Button } from '@/components/ui/button'
import { openScheduleInCalendar } from '@/lib/shopper/calendar-export'

interface EventSchedulePanelProps {
  items: EventScheduleItem[]
  eventLocation?: string | null
}

export function EventSchedulePanel({ items, eventLocation }: EventSchedulePanelProps) {
  if (items.length === 0) return null

  const now = new Date()
  const sorted = [...items].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  )

  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="font-heading text-lg font-semibold">Today&apos;s schedule</h2>
      <ol className="mt-4 space-y-3">
        {sorted.map((item) => {
          const start = new Date(item.starts_at)
          const end = item.ends_at ? new Date(item.ends_at) : null
          const live =
            end != null
              ? isWithinInterval(now, { start, end })
              : Math.abs(now.getTime() - start.getTime()) < 30 * 60 * 1000

          const location = item.location_label ?? eventLocation ?? undefined
          const description = [item.description, location].filter(Boolean).join(' · ')

          return (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-lg border border-stone-100 px-3 py-2 sm:flex-row sm:items-start sm:gap-3"
            >
              <div className="min-w-[4.5rem] shrink-0 text-sm font-medium text-muted-foreground">
                {format(start, 'h:mm a')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{item.title}</p>
                  {live && (
                    <Badge className={marketStatusBadge.success}>Happening now</Badge>
                  )}
                </div>
                {item.location_label && (
                  <p className="text-xs text-muted-foreground">{item.location_label}</p>
                )}
                {item.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 min-h-9 gap-1.5 touch-manipulation"
                  onClick={() =>
                    openScheduleInCalendar({
                      title: item.title,
                      description,
                      location,
                      startsAt: start,
                      endsAt: end,
                      uid: `schedule-${item.id}@popup-hub`,
                    })
                  }
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Add to calendar
                </Button>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
