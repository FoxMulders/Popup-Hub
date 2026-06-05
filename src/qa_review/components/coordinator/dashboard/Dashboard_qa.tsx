'use client'

/**
 * QA dashboard layout shell — curation queue removed, fixed-height left rail,
 * mandatory initial room modal before canvas mount, portal tooltips, text
 * section headers on toolbar accordions.
 *
 * Manual test wiring (temporary):
 *   import { DashboardBootstrapQa } from '@/src/qa_review/components/coordinator/dashboard/Dashboard_qa'
 *   // swap DashboardBootstrap -> DashboardBootstrapQa in market-dashboard-client.tsx
 *
 *   import { CanvasCommandBarQa } from '@/src/qa_review/components/coordinator/floor-plan-v2/tools/canvas-command-bar_qa'
 *   // swap CanvasCommandBar -> CanvasCommandBarQa in floor-plan-v2.tsx (dashboard ribbon)
 */

export {
  TooltipWrapperQa,
  QA_DASHBOARD_SIDEBAR_WIDTH_PX,
} from '@/src/qa_review/components/coordinator/dashboard/tooltip-wrapper_qa'
export { CanvasToolbarStaticQa, QA_STATIC_ROW_HEADERS } from '@/src/qa_review/components/coordinator/floor-plan-v2/tools/canvas-toolbar-static_qa'
export { CanvasCommandBarQa } from '@/src/qa_review/components/coordinator/floor-plan-v2/tools/canvas-command-bar_qa'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { LayoutGrid } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { addLayoutRoomToList } from '@/lib/coordinator/dashboard-layout-rooms'
import { MIN_ROOM_DIMENSION_FT } from '@/components/coordinator/floor-plan-v2/state/room-canvas'
import { DashboardAppShell } from '@/components/coordinator/dashboard/dashboard-app-shell'
import { DashboardCanvasColumn } from '@/components/coordinator/dashboard/dashboard-canvas-column'
import {
  DashboardToolbarPortalProvider,
  DashboardToolbarPortalTarget,
} from '@/components/coordinator/dashboard/dashboard-toolbar-portal'
import { useCommandCenterFullscreen } from '@/components/coordinator/dashboard/command-center-fullscreen-context'
import { useMarketManagement } from '@/components/coordinator/dashboard/market-management-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const DEFAULT_WIDTH_FT = 50
const DEFAULT_LENGTH_FT = 50

/** Left rail — layout tool accordions only (Market Intake / Curation Queue removed). */
export function DashboardLeftPanelQa() {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col justify-start overflow-hidden bg-white">
      {/*
        Tooltips portal to document.body (TooltipWrapperQa) so hints are not
        clipped by this panel's overflow-hidden. CanvasCommandBarQa supplies
        text section headers instead of standalone row icon badges.
      */}
      <DashboardToolbarPortalTarget className="relative z-0 min-h-0 flex-1 overflow-hidden border-b-0 px-1 py-1" />
    </div>
  )
}

export interface InitialRoomModalQaProps {
  onConfirm: (widthFt: number, lengthFt: number) => void
}

/** Mandatory pre-flight modal — blocks canvas until first room dimensions are set. */
export function InitialRoomModalQa({ onConfirm }: InitialRoomModalQaProps) {
  const [widthFt, setWidthFt] = useState(DEFAULT_WIDTH_FT)
  const [lengthFt, setLengthFt] = useState(DEFAULT_LENGTH_FT)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onConfirm(
      Math.max(MIN_ROOM_DIMENSION_FT, Math.round(widthFt)),
      Math.max(MIN_ROOM_DIMENSION_FT, Math.round(lengthFt))
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="initial-room-modal-qa-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl"
      >
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <LayoutGrid className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              id="initial-room-modal-qa-title"
              className="font-heading text-lg font-semibold text-foreground"
            >
              Create your first room
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set the venue footprint before the CAD canvas opens. You can add more rooms later from
              the toolbar.
            </p>
          </div>
        </div>

        <fieldset className="space-y-4 border-0 p-0">
          <legend className="sr-only">Room dimensions</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Width (ft)</span>
              <Input
                type="number"
                min={MIN_ROOM_DIMENSION_FT}
                step={1}
                value={widthFt}
                onChange={(e) => setWidthFt(Number(e.target.value) || DEFAULT_WIDTH_FT)}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Length (ft)</span>
              <Input
                type="number"
                min={MIN_ROOM_DIMENSION_FT}
                step={1}
                value={lengthFt}
                onChange={(e) => setLengthFt(Number(e.target.value) || DEFAULT_LENGTH_FT)}
                required
              />
            </label>
          </div>
        </fieldset>

        <Button type="submit" className="mt-6 w-full">
          Open layout designer
        </Button>
      </form>
    </div>
  )
}

export interface DashboardBootstrapQaProps {
  header: ReactNode
}

/**
 * QA dashboard bootstrap — no curation column, fixed left panel height,
 * canvas gated behind initial room modal.
 */
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
    (widthFt: number, lengthFt: number) => {
      const { rooms, activeRoomId } = addLayoutRoomToList(layoutRooms, { widthFt, lengthFt })
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
        leftClassName={cn(
          'w-80 flex flex-col justify-start overflow-hidden border-r border-gray-200 bg-white',
          'h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)]'
        )}
        left={<DashboardLeftPanelQa />}
        center={
          <DashboardCanvasColumn
            showBlueprint={false}
            mountCanvas={Boolean(selectedEventId && hasInitialRoom)}
            reducedMotion={reducedMotion}
            onCanvasInteractive={handleCanvasInteractive}
          />
        }
      />
      {selectedEventId && !hasInitialRoom ? (
        <InitialRoomModalQa onConfirm={handleInitialRoomConfirm} />
      ) : null}
    </DashboardToolbarPortalProvider>
  )
}

/** Convenience re-export for one-line client swap. */
export { DashboardBootstrapQa as DashboardQa }
