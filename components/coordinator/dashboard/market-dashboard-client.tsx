'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LayoutRoom } from '@/types/database'
import {
  MarketManagementProvider,
  type DashboardEventSummary,
  type EventLayoutBundle,
} from './market-management-context'
import type { VendorApplicationSnapshot } from './booth-placement-status'
import { DashboardBootstrap } from './dashboard-bootstrap'

export interface MarketDashboardClientProps {
  events: DashboardEventSummary[]
  initialEventId: string | null
  layoutsByEventId: Record<string, EventLayoutBundle>
  approvedByEventId: Record<string, VendorApplicationSnapshot[]>
  pendingByEventId: Record<string, VendorApplicationSnapshot[]>
  boothPriceByEventAndApplicationId: Record<string, Record<string, number>>
  squareConnected: boolean
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
  totalRevenueCents,
}: MarketDashboardClientProps) {
  if (events.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-semibold">Coordinator command center</h1>
        <p className="mt-2 text-muted-foreground">
          Create your first market to unlock the 3-column booth designer and live telemetry desk.
        </p>
        <Link href="/coordinator/events/new" className="mt-6">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden />
            New Event
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <MarketManagementProvider
      events={events}
      initialEventId={initialEventId}
      layoutsByEventId={layoutsByEventId}
      approvedByEventId={approvedByEventId}
      pendingByEventId={pendingByEventId}
      boothPriceByEventAndApplicationId={boothPriceByEventAndApplicationId}
      squareConnected={squareConnected}
      totalRevenueCents={totalRevenueCents}
    >
      <DashboardBootstrap
        header={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-xl font-semibold sm:text-2xl">
                Market command center
              </h1>
              <p className="text-sm text-muted-foreground">
                CAD booth designer · curation queue · Square telemetry
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/coordinator/square-connect">
                <Button variant="outline" size="sm">
                  Square
                </Button>
              </Link>
              <Link href="/coordinator/events/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" aria-hidden />
                  New market
                </Button>
              </Link>
            </div>
          </div>
        }
      />
    </MarketManagementProvider>
  )
}
