'use client'

import type { ReactNode } from 'react'
import { DashboardAppShell } from '@/components/coordinator/dashboard/dashboard-app-shell'
import { DashboardCurationColumn } from '@/components/coordinator/dashboard/dashboard-curation-column'
import { DashboardTelemetryColumn } from '@/components/coordinator/dashboard/dashboard-telemetry-column'
import { useMarketManagement } from '@/components/coordinator/dashboard/market-management-context'
import {
  ExternalListingInvoicingMock,
  ExternalListingMapBuilderMock,
  ExternalListingVendorInboxMock,
} from './external-listing-mocks'
import { LockedModuleShell } from './locked-module-shell'
import { useNativeMarketUnlock } from './use-native-market-unlock'

export interface DashboardWorkspaceProps {
  header: ReactNode
  toolbarStrip?: ReactNode | null
  immersive?: boolean
  ariaBusy?: boolean
  className?: string
  squareConnected: boolean
  centerNative: ReactNode
  centerFooter?: ReactNode
  ready?: boolean
  animate?: boolean
}

export function DashboardWorkspace({
  header,
  toolbarStrip,
  immersive = false,
  ariaBusy,
  className,
  squareConnected,
  centerNative,
  centerFooter,
  ready = true,
  animate = true,
}: DashboardWorkspaceProps) {
  const { events, selectedEventId } = useMarketManagement()
  const selectedEvent = events.find((event) => event.id === selectedEventId)
  const isExternalListing = selectedEvent?.isExternalListing === true
  const { unlocking, handleUpgrade } = useNativeMarketUnlock({ squareConnected })

  const locked = isExternalListing || unlocking

  const leftColumn = locked ? (
    <LockedModuleShell
      locked={locked}
      unlocking={unlocking}
      title="Vendor Inbox"
      description="Review certified vendor applications, documents, and booth requests in one real-time intake queue."
      tooltipId="vendor_inbox"
      onUpgrade={handleUpgrade}
    >
      <ExternalListingVendorInboxMock />
    </LockedModuleShell>
  ) : (
    <DashboardCurationColumn ready={ready} animate={animate} />
  )

  const centerColumn = locked ? (
    <LockedModuleShell
      locked={locked}
      unlocking={unlocking}
      title="Map Builder"
      description="Design verified booth footprints, clearance zones, and patron flow with the full HubGrid canvas."
      tooltipId="map_builder"
      onUpgrade={handleUpgrade}
    >
      <ExternalListingMapBuilderMock />
    </LockedModuleShell>
  ) : (
    centerNative
  )

  const rightColumn = locked ? (
    <LockedModuleShell
      locked={locked}
      unlocking={unlocking}
      title="Invoicing & Payments"
      description="Track booth payments, splits, and deposits with automated accounting tied to your live floor plan."
      tooltipId="invoicing_ledger"
      onUpgrade={handleUpgrade}
    >
      <ExternalListingInvoicingMock />
    </LockedModuleShell>
  ) : (
    <DashboardTelemetryColumn ready={ready} animate={animate} />
  )

  return (
    <DashboardAppShell
      header={header}
      toolbarStrip={toolbarStrip}
      immersive={immersive}
      ariaBusy={ariaBusy}
      className={className}
      left={immersive ? null : leftColumn}
      center={
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">{centerColumn}</div>
          {centerFooter}
        </div>
      }
      right={immersive ? null : rightColumn}
    />
  )
}
