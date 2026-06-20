'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { cn } from '@/lib/utils'
import { useDashboardWorkspaceView } from './dashboard-workspace-view-context'
import { useMarketManagement } from './market-management-context'

const MINIMAL_ACTION_CLASS =
  'inline-flex min-h-7 shrink-0 items-center gap-1 text-xs font-medium text-forest transition-colors hover:text-forest/80 hover:underline disabled:pointer-events-none disabled:opacity-50'

/**
 * Workflow CTA beneath the ledger — routes coordinators through
 * HubGrid → Allocation Ledger → Event overview.
 */
export function DashboardNextStepCta({
  className,
  inline = false,
}: {
  className?: string
  /** When true, render as a compact footer row instead of a prominent button. */
  inline?: boolean
}) {
  const { selectedEventId, pendingApplications, telemetry, hasClearanceIssues } =
    useMarketManagement()
  const { isBlueprint, isLedger, setView } = useDashboardWorkspaceView()
  const { squareConnected, stripeConnected } = telemetry

  if (!selectedEventId) return null

  const paymentsReady = squareConnected || stripeConnected
  const hasPending = pendingApplications.length > 0
  const allocationsComplete =
    telemetry.totalBooths > 0 && telemetry.unassignedBooths === 0

  const clearanceBlocked = isBlueprint && hasClearanceIssues
  const clearanceTooltip =
    'Vendor booths need at least 3′ edge clearance from neighbors and walls — widen aisles until red/yellow tints turn green (4′).'

  if (isBlueprint) {
    if (inline) return null

    const label = 'Next step: Allocation Ledger'
    const detail = clearanceBlocked
      ? 'Booths need at least 3′ clearance — yellow at 3′–4′, red below 3′ (see legend panel)'
      : 'Finalize vendor mapping and booth payments in the ledger'

    const button = (
      <button
        type="button"
        disabled={clearanceBlocked}
        className={cn(
          buttonVariants({ size: 'lg' }),
          'flex w-full items-center gap-2 rounded-xl border-2 border-forest bg-forest text-left text-white shadow-lg shadow-forest/25 hover:bg-forest/90 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55'
        )}
        onClick={() => setView('ledger')}
      >
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-bold uppercase tracking-wide">{label}</span>
          <span className="ml-2 text-xs font-normal text-white/90">{detail}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
      </button>
    )

    return (
      <div className={cn('dashboard-next-step-cta pointer-events-auto w-full max-w-none', className)}>
        {clearanceBlocked ? (
          <TooltipWrapper text={clearanceTooltip} className="w-full">
            {button}
          </TooltipWrapper>
        ) : (
          button
        )}
      </div>
    )
  }

  const href = hasPending
    ? `/coordinator/events/${selectedEventId}/applications`
    : paymentsReady && allocationsComplete
      ? `/coordinator/events/${selectedEventId}`
      : '/coordinator/payment-methods'

  const label = hasPending
    ? 'Review invites'
    : paymentsReady && allocationsComplete
      ? 'Event overview'
      : allocationsComplete
        ? 'Set up payments'
        : 'Complete allocations'

  const detail = hasPending
    ? `${pendingApplications.length} vendor${pendingApplications.length === 1 ? '' : 's'} awaiting review`
    : paymentsReady && allocationsComplete
      ? 'Send priority invites or manage booth payments'
      : allocationsComplete
        ? 'Connect Square or Stripe to collect booth fees'
        : `${telemetry.unassignedBooths} booth${telemetry.unassignedBooths === 1 ? '' : 's'} still need vendors`

  const ledgerBlocked = isLedger && !allocationsComplete && !hasPending

  if (inline) {
    const action = (
      <Link
        href={href}
        className={cn(MINIMAL_ACTION_CLASS, ledgerBlocked && 'pointer-events-none opacity-50')}
        aria-disabled={ledgerBlocked ? true : undefined}
        onClick={(e) => {
          if (ledgerBlocked) e.preventDefault()
        }}
      >
        {label}
        <ArrowRight className="h-3 w-3" aria-hidden />
      </Link>
    )

    return (
      <div
        className={cn(
          'dashboard-next-step-cta flex min-w-0 items-center justify-between gap-3 text-xs',
          className
        )}
      >
        <span className="min-w-0 truncate text-muted-foreground">{detail}</span>
        {ledgerBlocked ? (
          <TooltipWrapper text="Assign vendors to every booth before proceeding.">
            {action}
          </TooltipWrapper>
        ) : (
          action
        )}
      </div>
    )
  }

  const prominentLabel = hasPending
    ? 'Next step: Review invites'
    : paymentsReady && allocationsComplete
      ? 'Next step: Event overview'
      : allocationsComplete
        ? 'Next step: Set up payments'
        : 'Next step: Complete allocations'

  const link = (
    <Link
      href={href}
      className={cn(
        buttonVariants({ size: 'lg' }),
        'flex w-full items-center gap-2 rounded-xl border-2 border-forest bg-forest text-left text-white shadow-lg shadow-forest/25 hover:bg-forest/90 focus-visible:ring-offset-2',
        ledgerBlocked && 'pointer-events-none opacity-55'
      )}
      aria-disabled={ledgerBlocked ? true : undefined}
      onClick={(e) => {
        if (ledgerBlocked) e.preventDefault()
      }}
    >
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="font-bold uppercase tracking-wide">{prominentLabel}</span>
        <span className="ml-2 text-xs font-normal text-white/90">{detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
    </Link>
  )

  return (
    <div className={cn('dashboard-next-step-cta pointer-events-auto w-full max-w-none', className)}>
      {ledgerBlocked ? (
        <TooltipWrapper text="Assign vendors to every booth before proceeding." className="w-full">
          {link}
        </TooltipWrapper>
      ) : (
        link
      )}
    </div>
  )
}
