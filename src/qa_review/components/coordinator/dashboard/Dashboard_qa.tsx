'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
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
import { AiGenerationGuardrailsQa } from '@/src/qa_review/components/coordinator/dashboard/ai-generation-guardrails_qa'
import { cn } from '@/lib/utils'

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

export function QaAccordionHeader({ children }: { children: string }) {
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
    <div className="relative flex h-full min-h-0 w-full flex-col justify-start overflow-hidden bg-white">
      <AiGenerationGuardrailsQa />
      <DashboardToolbarPortalTarget
        className={cn(
          'min-h-0 flex-1 overflow-x-hidden overflow-y-auto border-b-0 px-1 py-1',
          QA_PANEL_SCROLL_CLASSES
        )}
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
  const [hasInitialRoom, setHasInitialRoom] = useState(() => layoutRooms.length > 0)

  useEffect(() => {
    setHasInitialRoom(layoutRooms.length > 0)
  }, [selectedEventId, layoutRooms.length])

  const handleInitialRoomConfirm = useCallback(
    (widthFt: number, lengthFt: number, tableLengthFt?: LayoutBaselineTableLengthFt) => {
      const { rooms, activeRoomId } = addLayoutRoomToList(layoutRooms, {
        widthFt,
        lengthFt,
        ...(tableLengthFt != null ? { baselineTableLengthFt: tableLengthFt } : {}),
      })
      setLayoutRooms(rooms, activeRoomId)
      setHasInitialRoom(true)
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
        leftClassName="w-80 flex flex-col justify-start overflow-hidden border-r border-gray-200 bg-white lg:h-[calc(100vh-64px)]"
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
