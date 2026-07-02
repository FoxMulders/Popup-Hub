'use client'

import { useState } from 'react'
import {
  FloorPlanV2WizardQa,
  type FloorPlanV2Props,
} from '@/src/qa_review/components/coordinator/floor-plan-v2/floor-plan-v2_wizard_qa'
import {
  DesktopScreenRequiredOverlay,
  FloorPlanViewportLayoutProvider,
  useFloorPlanViewportLayout,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'
import { LayoutRoomBar } from '@/components/coordinator/layout-room-bar'
import { LayoutPlannerHeader } from '@/components/coordinator/layout-planner/layout-planner-header'
import { LayoutPlannerShellQa } from '@/src/qa_review/components/coordinator/layout-planner/layout-planner-shell_qa'
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
  eventDisplayName: string
  onBack: () => void
  navDisabled?: boolean
  plannerOverlap?: boolean
}

export function WizardStepFloorPlan(props: WizardStepFloorPlanProps) {
  return (
    <FloorPlanViewportLayoutProvider>
      <WizardStepFloorPlanInner {...props} />
    </FloorPlanViewportLayoutProvider>
  )
}

function WizardStepFloorPlanInner({
  mode = 'wizard',
  layoutCapacity,
  eventDisplayName,
  onBack,
  navDisabled = false,
  plannerOverlap = false,
  eventId,
  layoutRooms,
  layoutActiveRoomId,
  onLayoutRoomsChange,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
  ...floorPlanProps
}: WizardStepFloorPlanProps) {
  const { showDesktopRequired } = useFloorPlanViewportLayout()
  const [placedCount, setPlacedCount] = useState(0)

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
    <>
      <DesktopScreenRequiredOverlay eventId={eventId ?? undefined} />
      <LayoutPlannerShellQa
        mode={mode}
        className="w-full flex-1"
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
            <WizardNav step={3} onBack={onBack} nextDisabled={navDisabled} />
          </div>
        }
      >
        {showDesktopRequired ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center p-6 text-center">
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Booth layout needs a tablet or desktop. Save your market now and continue designing
              on a larger screen.
            </p>
          </div>
        ) : (
          <FloorPlanV2WizardQa
            {...floorPlanProps}
            eventId={eventId}
            layoutRooms={layoutRooms}
            layoutActiveRoomId={layoutActiveRoomId}
            onLayoutRoomsChange={onLayoutRoomsChange}
            onAddRoom={onAddRoom}
            onRenameRoom={onRenameRoom}
            onDeleteRoom={onDeleteRoom}
            layoutCapacity={layoutCapacity}
            onPlacedCountChange={setPlacedCount}
            chrome="embedded"
            className="w-full flex-1"
          />
        )}
      </LayoutPlannerShellQa>
    </>
  )
}
