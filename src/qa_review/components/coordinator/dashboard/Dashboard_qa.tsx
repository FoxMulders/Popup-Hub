'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { addLayoutRoomToList } from '@/lib/coordinator/dashboard-layout-rooms'
import { useCommandCenterFullscreen } from '@/components/coordinator/dashboard/command-center-fullscreen-context'
import { DashboardAppShell } from '@/components/coordinator/dashboard/dashboard-app-shell'
import { DashboardCanvasColumn } from '@/components/coordinator/dashboard/dashboard-canvas-column'
import { DashboardTabletToolsDock } from '@/components/coordinator/dashboard/dashboard-tablet-tools-dock'
import { DashboardToolbarPortalProvider } from '@/components/coordinator/dashboard/dashboard-toolbar-portal'
import { DashboardToolbarPortalTarget } from '@/components/coordinator/dashboard/dashboard-toolbar-portal'
import { InitialRoomModal } from '@/components/coordinator/dashboard/initial-room-modal'
import { useMarketManagement } from '@/components/coordinator/dashboard/market-management-context'
import {
  DesktopScreenRequiredOverlay,
  FloorPlanViewportLayoutProvider,
  useFloorPlanViewportLayout,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'
import { QA_CANVAS_VIEWPORT_CLASS } from '@/src/qa_review/components/coordinator/floor-plan-v2/canvas/Canvas_qa'

/** Hide scrollbar tracks while preserving smooth scroll on short viewports. */
export const QA_PANEL_SCROLL_CLASSES =
  'scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'

/** Minimal Placement HUD copy — absolute micro-tooltips for QA visual inspection. */
export const QA_PLACEMENT_TIP_VALID = 'Valid space'
export const QA_PLACEMENT_TIP_VIOLATION = 'Rule conflict'

/** Uppercase accordion section titles — merged rows use left/right pair via STATIC_ROW_QA_HEADERS. */
export const QA_ACCORDION_HEADERS = {
  'room-tools': { left: 'ROOM CONTROLS', right: 'DESIGNER TOOLS' },
  placement: { left: 'PATRON LAYOUT', right: 'VENDOR BOOTHS' },
} as const

export function QaAccordionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
      {children}
    </h3>
  )
}

export interface DashboardBootstrapQaProps {
  header: ReactNode
}

/**
 * QA dashboard bootstrap — fixed left rail, mandatory initial room modal,
 * portal-friendly toolbar mount (no curation queue).
 */
export function DashboardLeftPanelQa() {
  return (
    <div className="relative flex w-full flex-col justify-start bg-white">
      <DashboardToolbarPortalTarget
        className="flex-1 overflow-x-hidden border-b-0 px-1 py-1"
      />
    </div>
  )
}

export function DashboardBootstrapQa({ header }: DashboardBootstrapQaProps) {
  return (
    <FloorPlanViewportLayoutProvider>
      <DesktopScreenRequiredOverlay />
      <DashboardBootstrapQaInner header={header} />
    </FloorPlanViewportLayoutProvider>
  )
}

function DashboardBootstrapQaInner({ header }: DashboardBootstrapQaProps) {
  const { showDesktopRequired } = useFloorPlanViewportLayout()
  const { fullscreen: immersive } = useCommandCenterFullscreen()
  const { selectedEventId, layoutRooms, setLayoutRooms } = useMarketManagement()
  const reducedMotion = useReducedMotion()
  const [ariaBusy, setAriaBusy] = useState(true)
  const [liveMessage, setLiveMessage] = useState('Booth layout designer loading.')
  const hasInitialRoom = layoutRooms.length > 0

  const handleInitialRoomConfirm = useCallback(
    (widthFt: number, lengthFt: number) => {
      const { rooms, activeRoomId } = addLayoutRoomToList(layoutRooms, {
        widthFt,
        lengthFt,
      })
      setLayoutRooms(rooms, activeRoomId)
      setLiveMessage('Room created — booth designer canvas is loading.')
    },
    [layoutRooms, setLayoutRooms]
  )

  const handleCanvasInteractive = useCallback(() => {
    setAriaBusy(false)
    setLiveMessage('Booth designer canvas is ready.')
  }, [])

  const showBlueprint = false
  const mountCanvas = Boolean(selectedEventId && hasInitialRoom && !showDesktopRequired)

  return (
    <DashboardToolbarPortalProvider>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </span>
      <DashboardAppShell
        header={header}
        immersive={immersive}
        ariaBusy={ariaBusy}
        leftLabel="Layout tools"
        className="dashboard-app-shell--qa-global-scroll"
        leftClassName="flex w-[300px] min-w-[300px] flex-shrink-0 flex-col justify-start border-r border-gray-200 bg-white"
        tabletLeft={<DashboardTabletToolsDock />}
        left={<DashboardLeftPanelQa />}
        center={
          <div className={QA_CANVAS_VIEWPORT_CLASS}>
            {showDesktopRequired ? (
              <div
                className="flex h-full min-h-[40vh] items-center justify-center p-6 text-center"
                aria-hidden
              />
            ) : (
              <DashboardCanvasColumn
                showBlueprint={showBlueprint}
                mountCanvas={mountCanvas}
                reducedMotion={reducedMotion}
                onCanvasInteractive={handleCanvasInteractive}
              />
            )}
          </div>
        }
      />
      {selectedEventId && !hasInitialRoom && !showDesktopRequired ? (
        <InitialRoomModal onConfirm={handleInitialRoomConfirm} />
      ) : null}
    </DashboardToolbarPortalProvider>
  )
}

export { InitialRoomModal as InitialRoomModalQa } from '@/components/coordinator/dashboard/initial-room-modal'

/** PATRON LAYOUT — Perimeter mode marches along the local room ∪ stage union ring. */
export { runPatronPerimeterLayout } from '@/src/utils/layoutMergeEngine'

/** VENDOR BOOTHS — Perimeter mode uses the same boolean union path (zero API tokens). */
export { runVendorPerimeterLayout } from '@/src/utils/layoutMergeEngine'
