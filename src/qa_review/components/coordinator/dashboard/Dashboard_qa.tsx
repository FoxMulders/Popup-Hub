'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { addLayoutRoomToList } from '@/lib/coordinator/dashboard-layout-rooms'
import type { LayoutBaselineTableLengthFt } from '@/lib/booth-planner/layout-table-size'
import { useCommandCenterFullscreen } from '@/components/coordinator/dashboard/command-center-fullscreen-context'
import { DashboardAppShell } from '@/components/coordinator/dashboard/dashboard-app-shell'
import { DashboardCanvasColumn } from '@/components/coordinator/dashboard/dashboard-canvas-column'
import { DashboardToolbarPortalProvider } from '@/components/coordinator/dashboard/dashboard-toolbar-portal'
import { DashboardToolbarPortalTarget } from '@/components/coordinator/dashboard/dashboard-toolbar-portal'
import { InitialRoomModal } from '@/components/coordinator/dashboard/initial-room-modal'
import { useMarketManagement } from '@/components/coordinator/dashboard/market-management-context'
import { QA_CANVAS_VIEWPORT_CLASS } from '@/src/qa_review/components/coordinator/floor-plan-v2/canvas/Canvas_qa'

/** Hide scrollbar tracks while preserving smooth scroll on short viewports. */
export const QA_PANEL_SCROLL_CLASSES =
  'scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'

/** Minimal Placement HUD copy — absolute micro-tooltips for QA visual inspection. */
export const QA_PLACEMENT_TIP_VALID = 'Valid space'
export const QA_PLACEMENT_TIP_VIOLATION = 'Rule conflict'

/** Uppercase accordion section titles — no standalone row icons. */
export const QA_ACCORDION_HEADERS = {
  room: 'ROOM CONTROLS',
  patron: 'PATRON LAYOUT',
  vendor: 'VENDOR BOOTHS',
  tools: 'DESIGNER TOOLS',
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
  const { fullscreen: immersive } = useCommandCenterFullscreen()
  const { selectedEventId, layoutRooms, setLayoutRooms } = useMarketManagement()
  const reducedMotion = useReducedMotion()
  const [ariaBusy, setAriaBusy] = useState(true)
  const [liveMessage, setLiveMessage] = useState('Booth layout designer loading.')
  const hasInitialRoom = layoutRooms.length > 0

  const handleInitialRoomConfirm = useCallback(
    (widthFt: number, lengthFt: number, tableLengthFt?: LayoutBaselineTableLengthFt) => {
      const { rooms, activeRoomId } = addLayoutRoomToList(layoutRooms, {
        widthFt,
        lengthFt,
        ...(tableLengthFt != null ? { baselineTableLengthFt: tableLengthFt } : {}),
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
        leftClassName="w-80 flex flex-col justify-start border-r border-gray-200 bg-white"
        left={<DashboardLeftPanelQa />}
        center={
          <div className={QA_CANVAS_VIEWPORT_CLASS}>
            <DashboardCanvasColumn
              showBlueprint={showBlueprint}
              mountCanvas={Boolean(selectedEventId && hasInitialRoom)}
              reducedMotion={reducedMotion}
              onCanvasInteractive={handleCanvasInteractive}
            />
          </div>
        }
      />
      {selectedEventId && !hasInitialRoom ? (
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
