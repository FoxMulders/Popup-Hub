'use client'

import { useState } from 'react'
import { FloorPlanV2, type FloorPlanV2Props } from '@/components/coordinator/floor-plan-v2/floor-plan-v2'
import { LayoutRoomBar } from '@/components/coordinator/layout-room-bar'
import { LayoutPlannerHeader } from '@/components/coordinator/layout-planner/layout-planner-header'
import { LayoutPlannerShell } from '@/components/coordinator/layout-planner/layout-planner-shell'
import { LayoutPlannerStats } from '@/components/coordinator/layout-planner/layout-planner-stats'
import { WizardNav } from '@/components/coordinator/wizard/wizard-nav'
import type { SummaryVenueSelection } from '@/components/coordinator/wizard/wizard-summary-rail'

export interface WizardStepFloorPlanProps extends FloorPlanV2Props {
  mode?: 'wizard' | 'standalone'
  /** Retained for wizard summary rail compatibility — not rendered in shell. */
  scheduleLines?: string[]
  selectedVenue?: SummaryVenueSelection | null
  capacityLabel?: string | null
  tableSizeLabel?: string | null
  layoutCapacity: number
  totalCategoryCaps?: number
  configuredCategorySlots?: FloorPlanV2Props['configuredCategorySlots']
  eventDisplayName: string
  onBack: () => void
  navDisabled?: boolean
  plannerOverlap?: boolean
  onPlacedCountChange?: (count: number) => void
}

export function WizardStepFloorPlan({
  mode = 'wizard',
  layoutCapacity,
  eventDisplayName,
  onBack,
  navDisabled = false,
  plannerOverlap = false,
  totalCategoryCaps = 0,
  onPlacedCountChange: onPlacedCountChangeExternal,
  eventId,
  layoutRooms,
  layoutActiveRoomId,
  onLayoutRoomsChange,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
  configuredCategorySlots,
  onSaveMarket,
  saveMarketDisabled,
  saveMarketLoading,
  ...floorPlanProps
}: WizardStepFloorPlanProps) {
  const [placedCount, setPlacedCount] = useState(0)

  const handlePlacedCountChange = (count: number) => {
    setPlacedCount(count)
    onPlacedCountChangeExternal?.(count)
  }

  const configuredTotal =
    configuredCategorySlots?.reduce(
      (sum, slot) => sum + Math.max(0, slot.maxSlots),
      0
    ) ?? totalCategoryCaps

  const layoutStepBlocked =
    configuredTotal > 0 && placedCount === 0

  function handleSelectRoom(roomId: string) {
    onLayoutRoomsChange(layoutRooms, roomId)
  }

  const roomBar =
    onAddRoom && onRenameRoom && onDeleteRoom && layoutRooms.length > 0 ? (
      <LayoutRoomBar
        rooms={layoutRooms}
        activeRoomId={layoutActiveRoomId}
        onSelectRoom={handleSelectRoom}
        onAddRoom={onAddRoom}
        onRenameRoom={onRenameRoom}
        onDeleteRoom={onDeleteRoom}
        compact
      />
    ) : null

  return (
    <LayoutPlannerShell
      mode={mode}
      className="min-h-0 flex-1"
      header={
        <LayoutPlannerHeader
          mode="wizard"
          eventId={eventId ?? undefined}
          eventName={eventDisplayName}
          stepLabel="Step 3"
          title="Design your floor plan"
          hasOverlap={plannerOverlap}
          showDraftBadge
          onBack={onBack}
          onSave={onSaveMarket}
          saveDisabled={saveMarketDisabled || layoutStepBlocked}
          saveLoading={saveMarketLoading}
          saveLabel="Save market"
          fullEditorHref={
            eventId ? `/coordinator/events/${eventId}/layout` : undefined
          }
        />
      }
      leftRail={roomBar}
      stats={
        <LayoutPlannerStats
          placedCount={placedCount}
          layoutCapacity={layoutCapacity}
          hasOverlap={plannerOverlap}
        />
      }
      footer={
        <div className="px-3 py-1 sm:px-4">
          <WizardNav
            step={3}
            onBack={onBack}
            onNext={onSaveMarket}
            nextDisabled={navDisabled || saveMarketDisabled || layoutStepBlocked}
            nextLabel="Save market"
          />
        </div>
      }
    >
      <FloorPlanV2
        {...floorPlanProps}
        eventId={eventId}
        layoutRooms={layoutRooms}
        layoutActiveRoomId={layoutActiveRoomId}
        onLayoutRoomsChange={onLayoutRoomsChange}
        onAddRoom={onAddRoom}
        onRenameRoom={onRenameRoom}
        onDeleteRoom={onDeleteRoom}
        configuredCategorySlots={configuredCategorySlots}
        layoutCapacity={layoutCapacity}
        onPlacedCountChange={handlePlacedCountChange}
        onSaveMarket={onSaveMarket}
        saveMarketDisabled={saveMarketDisabled || layoutStepBlocked}
        saveMarketLoading={saveMarketLoading}
        chrome="embedded"
        className="h-full min-h-0"
      />
    </LayoutPlannerShell>
  )
}
