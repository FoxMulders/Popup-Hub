'use client'

import Link from 'next/link'
import { useCallback, useMemo } from 'react'
import { Check, Stamp, ArrowRight, Copy, ExternalLink, Pencil } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { MarketPanel, MarketPanelHeader, MarketPanelTitle } from '@/components/ui/market-panel'
import { cn } from '@/lib/utils'
import { vendorMarketInviteUrl } from '@/lib/coordinator/vendor-outreach'
import { VendorRecruitmentCallout } from '@/components/coordinator/vendor-recruitment-callout'
import { marketTheme } from '@/lib/theme/market'
import { toast } from '@/lib/toast'
import { isQuarterAuctionListing } from '@/lib/events/listing-type'
import type { Event, EventCategoryLimit } from '@/types/database'

interface EventReadinessChecklistProps {
  eventId: string
  event: Event & { category_limits?: EventCategoryLimit[] }
  applicationCount: number
  approvedCount: number
  hasLayout: boolean
  hasSquare: boolean
  pendingCount: number
  /** For quarter-auction listings: catalog has items or vendors approved for auction. */
  quarterAuctionCatalogReady?: boolean
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
  quarterAuctionCatalogReady = false,
}: EventReadinessChecklistProps) {
  const requiresSquare = (event.category_limits ?? []).some((cl) => cl.price_per_booth > 0)
  const isQuarterAuction = isQuarterAuctionListing(event.listing_type)
  const vendorInviteUrl = vendorMarketInviteUrl(eventId)

  const items: ChecklistItem[] = [
    { key: 'created', label: 'Event created', done: true },
    {
      key: 'categories',
      label: isQuarterAuction ? 'Vendor spots configured' : 'Categories & booth caps set',
      done: (event.category_limits?.length ?? 0) > 0,
    },
    {
      key: 'square',
      label: requiresSquare ? 'Square connected (paid booths)' : 'Square connected (optional)',
      done: !requiresSquare || event.square_merchant_id != null || hasSquare,
      skippable: !requiresSquare,
    },
    ...(event.skip_venue_layout
      ? []
      : [{ key: 'layout', label: 'Booth layout saved', done: hasLayout } satisfies ChecklistItem]),
    {
      key: 'venue',
      label: 'Venue verified',
      done:
        event.venue_verified === true ||
        event.venue_verification_status === 'verified' ||
        event.venue_verification_status === 'manual_override',
    },
    {
      key: 'contract',
      label: 'Booth contract reviewed',
      done: Boolean(event.booth_contract_updated_at) || event.booth_contract_enabled === false,
      skippable: event.booth_contract_enabled === false,
    },
    { key: 'published', label: 'Event published', done: event.status !== 'draft' },
    { key: 'applied', label: 'Vendors applied', done: applicationCount > 0 },
    { key: 'approved', label: 'Vendors approved', done: approvedCount > 0 },
    ...(isQuarterAuction
      ? [
          {
            key: 'auction',
            label: 'Auction catalog ready',
            done: quarterAuctionCatalogReady,
            skippable: true,
          } satisfies ChecklistItem,
        ]
      : []),
  ]

  const completedCount = items.filter((i) => i.done).length
  const total = items.length
  const firstIncomplete = items.find((i) => !i.done)

  const stepActions = useMemo((): Record<string, StepAction> => {
    return {
      venue: {
        type: 'link',
        href: `/coordinator/events/${eventId}/edit#venue`,
        label: 'Verify venue on map',
      },
      published: {
        type: 'scroll',
        targetId: 'event-status',
        label: 'Publish from status menu',
      },
      contract: {
        type: 'link',
        href: `/coordinator/events/${eventId}/edit#booth-contract`,
        label: 'Review digital booth contract',
      },
      categories: {
        type: 'link',
        href: `/coordinator/events/${eventId}/edit#categories`,
        label: isQuarterAuction ? 'Set vendor spots' : 'Add categories & caps',
      },
      square: {
        type: 'link',
        href: '/coordinator/payment-methods',
        label: 'Connect Square',
      },
      applied: {
        type: 'copy',
        getText: () => vendorInviteUrl,
        label: 'Copy vendor invite link',
      },
      approved: {
        type: 'link',
        href: `/coordinator/events/${eventId}/applications`,
        label:
          pendingCount > 0
            ? `Review ${pendingCount} pending application${pendingCount === 1 ? '' : 's'}`
            : 'View applications',
      },
      layout: {
        type: 'link',
        href: `/coordinator/events/${eventId}/layout`,
        label: 'Open HubGrid',
      },
      auction: {
        type: 'link',
        href: `/coordinator/events/${eventId}/auctions`,
        label: 'Open auction control',
      },
    }
  }, [eventId, pendingCount, vendorInviteUrl, isQuarterAuction])

  const editStepActions = useMemo((): Record<string, StepAction> => {
    return {
      created: {
        type: 'link',
        href: `/coordinator/events/${eventId}/edit`,
        label: 'Edit event details',
      },
      categories: {
        type: 'link',
        href: `/coordinator/events/${eventId}/edit#categories`,
        label: isQuarterAuction ? 'Edit vendor spots' : 'Edit categories & caps',
      },
      published: {
        type: 'scroll',
        targetId: 'event-status',
        label: 'Change publish status',
      },
      contract: {
        type: 'link',
        href: `/coordinator/events/${eventId}/edit#booth-contract`,
        label: 'Edit booth contract',
      },
      square: {
        type: 'link',
        href: '/coordinator/payment-methods',
        label: 'Manage Square connection',
      },
      applied: {
        type: 'copy',
        getText: () => vendorInviteUrl,
        label: 'Copy vendor invite link',
      },
      approved: {
        type: 'link',
        href: `/coordinator/events/${eventId}/applications`,
        label: 'Review applications',
      },
      layout: {
        type: 'link',
        href: `/coordinator/events/${eventId}/layout`,
        label: 'Edit booth layout',
      },
      auction: {
        type: 'link',
        href: `/coordinator/events/${eventId}/auctions`,
        label: 'Manage auction catalog',
      },
    }
  }, [eventId])

  const nextStepHints: Record<string, string> = {
    published:
      'Use the status dropdown at the top of this page and choose “Publish Event” so vendors can discover and apply.',
    contract:
      'Review the default digital booth contract, add custom clauses, or attach your PDF before vendors apply.',
    categories: isQuarterAuction
      ? 'Add at least one vendor type with spot limits so vendors can apply.'
      : 'Add at least one vendor category with booth slot limits and pricing.',
    square: requiresSquare
      ? 'Connect Square before accepting paid booth fees.'
      : 'Optional for free events — skip if you are not charging booth fees.',
    applied:
      'Share your vendor invite link on Facebook, email, or social — makers sign up and land on your market apply page in one step.',
    approved: 'Approve vendors from the applications board below.',
    layout: 'Place booths in the layout planner and save.',
    auction:
      'Approve vendors and add catalog items on the auction control page — bid amounts are set per item at showtime.',
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

  function StepActionControl({
    action,
    variant,
    className,
  }: {
    action: StepAction
    variant: 'inline' | 'button'
    className?: string
  }) {
    if (action.type === 'link') {
      if (variant === 'inline') {
        return (
          <Link
            href={action.href}
            className={cn(
              'mt-1.5 flex items-center gap-1 text-xs font-medium hover:underline',
              className
            )}
          >
            <Pencil className="h-3 w-3 shrink-0" />
            {action.label}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </Link>
        )
      }
      return (
        <Link
          href={action.href}
          className={cn(buttonVariants({ size: 'sm' }), 'mt-3 w-full sm:w-auto gap-1.5 inline-flex', className)}
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )
    }

    const Icon = action.type === 'copy' ? Copy : ArrowRight
    if (variant === 'inline') {
      return (
        <button
          type="button"
          className={cn(
            'mt-1.5 flex items-center gap-1 text-xs font-medium hover:underline',
            className
          )}
          onClick={() => runAction(action)}
        >
          <Pencil className="h-3 w-3 shrink-0" />
          {action.label}
          <Icon className="h-3 w-3 shrink-0" />
        </button>
      )
    }

    return (
      <Button
        type="button"
        size="sm"
        className={cn('mt-3 w-full sm:w-auto gap-1.5', className)}
        onClick={() => runAction(action)}
      >
        {action.label}
        <Icon className="h-4 w-4" />
      </Button>
    )
  }

  function ContinueButton({ stepKey }: { stepKey: string }) {
    const action = stepActions[stepKey]
    if (!action) return null
    return <StepActionControl action={action} variant="button" />
  }

  return (
    <MarketPanel className="scroll-mt-24 p-0 overflow-hidden" id="event-setup-checklist">
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
          const editAction = item.done ? editStepActions[item.key] : undefined
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
                  {isNext && action && (
                    <StepActionControl
                      action={action}
                      variant="inline"
                      className="text-harvest-700"
                    />
                  )}
                  {editAction && (
                    <StepActionControl
                      action={editAction}
                      variant="inline"
                      className="text-primary-foreground/85 hover:text-primary-foreground"
                    />
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
          {firstIncomplete.key === 'applied' ? (
            <div className="mt-3">
              <VendorRecruitmentCallout
                variant="compact"
                eventId={eventId}
                eventName={event.name}
                eventStatus={event.status}
                className="border-harvest-300/80 bg-white/70"
              />
            </div>
          ) : (
            <ContinueButton stepKey={firstIncomplete.key} />
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
