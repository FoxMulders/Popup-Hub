'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMarketManagement } from './market-management-context'

/**
 * Primary workflow CTA beside the floor plan canvas — routes coordinators toward
 * vendor invites or payment setup based on pending application volume.
 */
export function DashboardNextStepCta({ className }: { className?: string }) {
  const { selectedEventId, pendingApplications, telemetry } = useMarketManagement()
  const { squareConnected, stripeConnected } = telemetry

  if (!selectedEventId) return null

  const paymentsReady = squareConnected || stripeConnected
  const hasPending = pendingApplications.length > 0

  const href = hasPending
    ? `/coordinator/events/${selectedEventId}/applications`
    : paymentsReady
      ? `/coordinator/events/${selectedEventId}`
      : '/coordinator/payment-methods'

  const label = hasPending
    ? 'Next step: Review invites'
    : paymentsReady
      ? 'Next step: Event overview'
      : 'Next step: Set up payments'

  const detail = hasPending
    ? `${pendingApplications.length} vendor${pendingApplications.length === 1 ? '' : 's'} awaiting review`
    : paymentsReady
      ? 'Send priority invites or manage booth payments'
      : 'Connect Square or Stripe to collect booth fees'

  return (
    <div
      className={cn(
        'dashboard-next-step-cta pointer-events-auto absolute bottom-4 right-4 z-[10002] max-w-[min(100%,20rem)]',
        className
      )}
    >
      <Link
        href={href}
        className={cn(
          buttonVariants({ size: 'lg' }),
          'flex w-full flex-col items-start gap-0.5 rounded-xl border-2 border-forest bg-forest px-4 py-3 text-left text-white shadow-lg shadow-forest/25 hover:bg-forest/90 focus-visible:ring-offset-2'
        )}
      >
        <span className="flex w-full items-center justify-between gap-2 text-sm font-bold uppercase tracking-wide">
          {label}
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
        </span>
        <span className="text-xs font-normal text-white/90">{detail}</span>
      </Link>
    </div>
  )
}
