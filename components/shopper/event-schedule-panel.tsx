import { format, isWithinInterval } from 'date-fns'
import type { EventScheduleItem } from '@/types/database'
import { Badge } from '@/components/ui/badge'

interface EventSchedulePanelProps {
  items: EventScheduleItem[]
}

export function EventSchedulePanel({ items }: EventSchedulePanelProps) {
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

          return (
            <li
              key={item.id}
              className="flex gap-3 rounded-lg border border-stone-100 px-3 py-2"
            >
              <div className="min-w-[4.5rem] shrink-0 text-sm font-medium text-muted-foreground">
                {format(start, 'h:mm a')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{item.title}</p>
                  {live && (
                    <Badge className="bg-green-100 text-green-800">Happening now</Badge>
                  )}
                </div>
                {item.location_label && (
                  <p className="text-xs text-muted-foreground">{item.location_label}</p>
                )}
                {item.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
