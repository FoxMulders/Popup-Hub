'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { PortalRoleBadge } from '@/components/nav/portal-role-badge'
import { cn } from '@/lib/utils'
import { isMobileDevice } from '@/lib/pwa/platform'
import {
  MarketManagementProvider,
  type DashboardEventSummary,
  type EventLayoutBundle,
} from './market-management-context'
import type { VendorApplicationSnapshot } from './booth-placement-status'
import { CommandCenterFullscreenProvider } from './command-center-fullscreen-context'
import { DashboardLayoutSaveProvider } from './dashboard-layout-save-context'
import { DashboardBootstrapQa as DashboardBootstrap } from '@/src/qa_review/components/coordinator/dashboard/Dashboard_qa'
import { DashboardCommandCenterHeader } from './dashboard-command-center-header'
import { CoordinatorMobileOverview } from './coordinator-mobile-overview'

export interface MarketDashboardClientProps {
  events: DashboardEventSummary[]
  initialEventId: string | null
  layoutsByEventId: Record<string, EventLayoutBundle>
  approvedByEventId: Record<string, VendorApplicationSnapshot[]>
  pendingByEventId: Record<string, VendorApplicationSnapshot[]>
  boothPriceByEventAndApplicationId: Record<string, Record<string, number>>
  squareConnected: boolean
  stripeConnected: boolean
  totalRevenueCents: number
}

export function MarketDashboardClient({
  events,
  initialEventId,
  layoutsByEventId,
  approvedByEventId,
  pendingByEventId,
  boothPriceByEventAndApplicationId,
  squareConnected,
  stripeConnected,
  totalRevenueCents,
}: MarketDashboardClientProps) {
  const searchParams = useSearchParams()
  const forceMobileOverview = searchParams.get('overview') === 'mobile'
  const useMobileOverview = forceMobileOverview || isMobileDevice()

  if (events.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
        <PortalRoleBadge portal="coordinator" />
        <h1 className="mt-2 font-heading text-2xl font-semibold sm:text-3xl">Coordinator command center</h1>
        <p className="mt-2 text-muted-foreground">
          Create your first market to unlock the full-screen booth layout designer.
        </p>
        <Link
          href="/coordinator/events/new"
          className={cn(buttonVariants(), 'mt-6 gap-1.5')}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create New Market
        </Link>
      </div>
    )
  }

  if (useMobileOverview) {
    return (
      <CoordinatorMobileOverview
        events={events}
        totalRevenueCents={totalRevenueCents}
        squareConnected={squareConnected}
        stripeConnected={stripeConnected}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
    <MarketManagementProvider
      events={events}
      initialEventId={initialEventId}
      layoutsByEventId={layoutsByEventId}
      approvedByEventId={approvedByEventId}
      pendingByEventId={pendingByEventId}
      boothPriceByEventAndApplicationId={boothPriceByEventAndApplicationId}
      squareConnected={squareConnected}
      stripeConnected={stripeConnected}
      totalRevenueCents={totalRevenueCents}
    >
      <CommandCenterFullscreenProvider>
        <DashboardLayoutSaveProvider>
          <div className="coordinator-dashboard-workspace flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <DashboardBootstrap header={<DashboardCommandCenterHeader />} />
          </div>
        </DashboardLayoutSaveProvider>
      </CommandCenterFullscreenProvider>
    </MarketManagementProvider>
    </div>
  )
}
