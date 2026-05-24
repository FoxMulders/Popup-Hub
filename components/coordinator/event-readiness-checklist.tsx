'use client'

import Link from 'next/link'
import { useCallback, useMemo } from 'react'
import { Check, Stamp, ArrowRight, Copy, ExternalLink } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { MarketPanel, MarketPanelHeader, MarketPanelTitle } from '@/components/ui/market-panel'
import { cn } from '@/lib/utils'
import { publicAppUrl } from '@/lib/url/public-app-url'
import { marketTheme } from '@/lib/theme/market'
import { toast } from 'sonner'
import type { Event, EventCategoryLimit } from '@/types/database'

interface EventReadinessChecklistProps {
  eventId: string
  event: Event & { category_limits?: EventCategoryLimit[] }
  applicationCount: number
  approvedCount: number
  hasLayout: boolean
  hasSquare: boolean
  pendingCount: number
  hasAuction?: boolean
}

interface ChecklistItem {
  label: string
  done: boolean
  key: string
  skippable?: boolean
}

type StepAction =
  | { type: 'link'; href: string; label: string }
  | { type: 'scroll'; targetId: string; label: string }
  | { type: 'copy'; getText: () => string; label: string }

export function EventReadinessChecklist({
  eventId,
  event,
  applicationCount,
  approvedCount,
  hasLayout,
  hasSquare,
  pendingCount,
  hasAuction = false,
}: EventReadinessChecklistProps) {
  const requiresSquare = (event.category_limits ?? []).some((cl) => cl.price_per_booth > 0)
  const vendorListingUrl = publicAppUrl(`/events/${eventId}`)

  const items: ChecklistItem[] = [
    { key: 'created', label: 'Event created', done: true },
    {
      key: 'categories',
      label: 'Categories & booth caps set',
      done: (event.category_limits?.length ?? 0) > 0,
    },
    { key: 'published', label: 'Event published', done: event.status !== 'draft' },
    {
      key: 'square',
      label: requiresSquare ? 'Square connected (paid booths)' : 'Square connected (optional)',
      done: !requiresSquare || event.square_merchant_id != null || hasSquare,
      skippable: !requiresSquare,
    },
    { key: 'applied', label: 'Vendors applied', done: applicationCount > 0 },
    { key: 'approved', label: 'Vendors approved', done: approvedCount > 0 },
    ...(event.skip_venue_layout
      ? []
      : [{ key: 'layout', label: 'Booth layout saved', done: hasLayout } satisfies ChecklistItem]),
    {
      key: 'auction',
      label: 'Quarter auction configured',
      done: hasAuction,
      skippable: true,
    },
  ]

  const completedCount = items.filter((i) => i.done).length
  const total = items.length
  const firstIncomplete = items.find((i) => !i.done)

  const stepActions = useMemo((): Record<string, StepAction> => {
    return {
      published: {
        type: 'scroll',
        targetId: 'event-status',
        label: 'Publish from status menu',
      },
      categories: {
        type: 'link',
        href: `/coordinator/events/${eventId}/edit#categories`,
        label: 'Add categories & caps',
      },
      square: {
        type: 'link',
        href: '/coordinator/square-connect',
        label: 'Connect Square',
      },
      applied: {
        type: 'copy',
        getText: () => publicAppUrl(`/events/${eventId}`),
        label: 'Copy public listing link',
      },
      approved: {
        type: 'scroll',
        targetId: 'applications',
        label:
          pendingCount > 0
            ? `Review ${pendingCount} pending application${pendingCount === 1 ? '' : 's'}`
            : 'View applications',
      },
      layout: {
        type: 'link',
        href: `/coordinator/events/${eventId}/layout`,
        label: 'Open spatial planner',
      },
      auction: {
        type: 'link',
        href: `/coordinator/events/${eventId}/auctions`,
        label: 'Set up quarter auction',
      },
    }
  }, [eventId, pendingCount])

  const nextStepHints: Record<string, string> = {
    published:
      'Use the status dropdown at the top of this page and choose “Publish Event” so vendors can discover and apply.',
    categories:
      'Add at least one vendor category with booth slot limits and pricing.',
    square: requiresSquare
      ? 'Connect Square before accepting paid booth fees.'
      : 'Optional for free events — skip if you are not charging booth fees.',
    applied: 'Share your public event listing link with vendors.',
    approved: 'Approve vendors from the applications board below.',
    layout: 'Place booths in the layout planner and save.',
    auction: 'Create at least one quarter auction for market day, or skip if you are not running one.',
  }

  const runAction = useCallback((action: StepAction) => {
    if (action.type === 'scroll') {
      const el = document.getElementById(action.targetId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-harvest-400', 'ring-offset-2', 'rounded-lg')
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-harvest-400', 'ring-offset-2', 'rounded-lg')
        }, 2500)
      } else {
        toast.message('Could not scroll to that section — try refreshing the page.')
      }
      return
    }
    if (action.type === 'copy') {
      const text = action.getText()
      void navigator.clipboard.writeText(text).then(
        () => toast.success('Vendor listing link copied'),
        () => toast.error('Could not copy link')
      )
    }
  }, [])

  function ContinueButton({ stepKey }: { stepKey: string }) {
    const action = stepActions[stepKey]
    if (!action) return null

    if (action.type === 'link') {
      return (
        <Link
          href={action.href}
          className={cn(buttonVariants({ size: 'sm' }), 'mt-3 w-full sm:w-auto gap-1.5 inline-flex')}
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )
    }

    return (
      <Button
        type="button"
        size="sm"
        className="mt-3 w-full sm:w-auto gap-1.5"
        onClick={() => runAction(action)}
      >
        {action.label}
        {action.type === 'copy' ? (
          <Copy className="h-4 w-4" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
      </Button>
    )
  }

  return (
    <MarketPanel className="p-0 overflow-hidden" id="event-setup-checklist">
      <MarketPanelHeader>
        <div>
          <MarketPanelTitle>Event Setup</MarketPanelTitle>
          <p className="text-xs text-muted-foreground mt-0.5 font-sans">
            Your market-day checklist — work through each tag before doors open.
          </p>
        </div>
        <span className="rounded-full border-2 border-stone-200 bg-canvas px-3 py-1 text-xs font-semibold text-muted-foreground tabular-nums">
          {completedCount} / {total}
        </span>
      </MarketPanelHeader>

      <div className="px-5 pt-4 pb-2">
        <div className="market-setup-progress" role="progressbar" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={total}>
          {items.map((item) => (
            <div
              key={item.key}
              className={cn(
                'market-setup-progress-segment',
                item.done ? 'market-setup-progress-segment--done' : 'market-setup-progress-segment--pending'
              )}
              title={item.label}
            />
          ))}
        </div>
      </div>

      <ol className="space-y-2.5 px-5 pb-5 list-none">
        {items.map((item) => {
          const isNext = firstIncomplete?.key === item.key
          const action = !item.done ? stepActions[item.key] : undefined
          const tagClass = item.done
            ? marketTheme.checklistTagDone
            : isNext
              ? marketTheme.checklistTagActive
              : marketTheme.checklistTagPending

          return (
            <li key={item.key} aria-current={isNext && !item.done ? 'step' : undefined}>
              <div className={cn(marketTheme.checklistTag, tagClass)}>
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2',
                    item.done
                      ? 'border-primary-foreground/30 bg-forest-deep/40'
                      : isNext
                        ? 'border-harvest-400 bg-harvest-100'
                        : 'border-stone-200 bg-canvas'
                  )}
                  aria-hidden
                >
                  {item.done ? (
                    <Stamp className="market-stamp-icon h-4 w-4 -rotate-12" strokeWidth={2.25} />
                  ) : isNext ? (
                    <span className="h-2 w-2 rounded-full bg-harvest-500 animate-pulse" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-stone-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'text-sm leading-snug',
                        item.done && 'text-primary-foreground/95',
                        isNext && !item.done && 'font-semibold text-foreground',
                        !item.done && !isNext && 'text-foreground/90'
                      )}
                    >
                      {item.label}
                    </span>
                    {item.done && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-forest-deep/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                        <Check className="h-3 w-3" strokeWidth={3} />
                        Done
                      </span>
                    )}
                    {isNext && !item.done && (
                      <span className="rounded-md border border-harvest-400 bg-harvest-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-harvest-800">
                        Up next
                      </span>
                    )}
                  </div>
                  {item.skippable && !item.done && (
                    <span className="text-[10px] text-muted-foreground">(optional)</span>
                  )}
                  {isNext && action?.type === 'link' && (
                    <Link
                      href={action.href}
                      className="mt-1.5 flex items-center gap-1 text-xs text-harvest-700 hover:underline font-medium"
                    >
                      {action.label}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {firstIncomplete && (
        <div className="mx-5 mb-5 rounded-xl border-2 border-harvest-200 bg-harvest-50 px-4 py-3 shadow-[var(--shadow-market)]">
          <p className="text-xs font-heading font-semibold text-harvest-800 mb-1">Next step</p>
          <p className="text-sm text-harvest-900/90 leading-relaxed">
            {nextStepHints[firstIncomplete.key] ?? firstIncomplete.label}
          </p>
          <ContinueButton stepKey={firstIncomplete.key} />
          {firstIncomplete.key === 'applied' && (
            <p className="mt-2 text-[10px] text-harvest-700/80 break-all font-mono">{vendorListingUrl}</p>
          )}
        </div>
      )}

      {completedCount === total && (
        <div className="mx-5 mb-5 rounded-xl border-2 border-sage-200 bg-sage-50 px-4 py-3">
          <p className="text-xs font-heading font-semibold text-sage-800">
            All setup steps complete — your event is ready for market day.
          </p>
          <Link
            href={`/coordinator/events/${eventId}/operations`}
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'mt-2 inline-flex')}
          >
            Open Market Day Dashboard
          </Link>
        </div>
      )}
    </MarketPanel>
  )
}
