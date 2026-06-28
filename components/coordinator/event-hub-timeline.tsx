'use client'

import Link from 'next/link'
import { Check, CircleDot, ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EventReadinessChecklist } from '@/components/coordinator/event-readiness-checklist'
import { cn } from '@/lib/utils'
import type { Event, EventCategoryLimit } from '@/types/database'

interface EventHubTimelineProps {
  eventId: string
  event: Event & { category_limits?: EventCategoryLimit[] }
  applicationCount: number
  approvedCount: number
  pendingCount: number
  waitlistedCount: number
  assignedBoothCount: number
  hasLayout: boolean
  hasSquare: boolean
  quarterAuctionCatalogReady?: boolean
  eventRevenueFormatted: string
  isCancelled: boolean
}

type PhaseState = 'complete' | 'current' | 'upcoming'

interface TimelinePhase {
  id: string
  title: string
  summary: string
  state: PhaseState
  href?: string
  cta?: string
}

function phaseIcon(state: PhaseState) {
  if (state === 'complete') {
    return <Check className="h-4 w-4 text-sage-700" strokeWidth={3} aria-hidden />
  }
  return <CircleDot className="h-4 w-4 text-harvest-600" aria-hidden />
}

export function EventHubTimeline({
  eventId,
  event,
  applicationCount,
  approvedCount,
  pendingCount,
  waitlistedCount,
  assignedBoothCount,
  hasLayout,
  hasSquare,
  quarterAuctionCatalogReady = false,
  eventRevenueFormatted,
  isCancelled,
}: EventHubTimelineProps) {
  if (isCancelled) return null

  const isPublished = event.status !== 'draft'
  const categoriesReady = (event.category_limits?.length ?? 0) > 0
  const layoutReady = Boolean(event.skip_venue_layout) || hasLayout
  const setupComplete = categoriesReady && layoutReady

  const phases: TimelinePhase[] = [
    {
      id: 'setup',
      title: 'Market setup',
      summary: setupComplete
        ? 'Categories, venue, and layout configured'
        : 'Finish categories, venue, and HubGrid layout',
      state: setupComplete ? (isPublished ? 'complete' : 'current') : 'current',
      href: '#event-setup-checklist',
      cta: setupComplete ? 'Review setup checklist' : 'Continue setup',
    },
    {
      id: 'publish',
      title: 'Publish for vendors',
      summary: isPublished
        ? `Live as ${event.status}`
        : 'Publish so vendors can discover and apply',
      state: isPublished ? 'complete' : setupComplete ? 'current' : 'upcoming',
      href: isPublished ? undefined : `#event-status`,
      cta: isPublished ? undefined : 'Publish market',
    },
    {
      id: 'vendors',
      title: 'Vendor pipeline',
      summary: `${applicationCount} applied · ${pendingCount} pending · ${approvedCount} approved · ${assignedBoothCount} booths placed`,
      state: !isPublished ? 'upcoming' : pendingCount > 0 || approvedCount === 0 ? 'current' : 'complete',
      href: `/coordinator/events/${eventId}/applications`,
      cta: pendingCount > 0 ? `Review ${pendingCount} pending` : 'View applications',
    },
    {
      id: 'market-day',
      title: 'Market day',
      summary: `${eventRevenueFormatted} booth revenue · ${waitlistedCount} waitlisted`,
      state: isPublished && approvedCount > 0 && assignedBoothCount > 0 ? 'current' : 'upcoming',
      href: `/coordinator/events/${eventId}/operations`,
      cta: 'Open day-of dashboard',
    },
  ]

  const currentPhase = phases.find((p) => p.state === 'current') ?? phases[phases.length - 1]

  return (
    <div className="space-y-4">
      <div className="market-panel overflow-hidden p-0">
        <div className="border-b px-5 py-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">Market readiness</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One timeline from setup through market day — current focus:{' '}
            <span className="font-medium text-foreground">{currentPhase.title}</span>
          </p>
        </div>

        <ol className="divide-y">
          {phases.map((phase, index) => (
            <li key={phase.id} className="flex gap-4 px-5 py-4">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border',
                    phase.state === 'complete' && 'border-sage-200 bg-sage-50',
                    phase.state === 'current' && 'border-harvest-300 bg-harvest-50',
                    phase.state === 'upcoming' && 'border-stone-200 bg-white'
                  )}
                >
                  {phaseIcon(phase.state)}
                </span>
                {index < phases.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-stone-200 min-h-[1rem]" aria-hidden />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{phase.title}</h3>
                  {phase.state === 'current' ? (
                    <span className="rounded-full bg-harvest-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-harvest-800">
                      Now
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{phase.summary}</p>
                {phase.cta && phase.href ? (
                  phase.href.startsWith('#') ? (
                    <a
                      href={phase.href}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-forest hover:underline"
                    >
                      {phase.cta}
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </a>
                  ) : (
                    <Link
                      href={phase.href}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'mt-2 inline-flex gap-1.5'
                      )}
                    >
                      {phase.cta}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <EventReadinessChecklist
        eventId={eventId}
        event={event}
        applicationCount={applicationCount}
        approvedCount={approvedCount}
        hasLayout={hasLayout}
        hasSquare={hasSquare}
        pendingCount={pendingCount}
        quarterAuctionCatalogReady={quarterAuctionCatalogReady}
      />
    </div>
  )
}
