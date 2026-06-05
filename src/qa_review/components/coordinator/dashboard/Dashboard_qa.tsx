'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { addLayoutRoomToList } from '@/lib/coordinator/dashboard-layout-rooms'
import { useCommandCenterFullscreen } from '@/components/coordinator/dashboard/command-center-fullscreen-context'
import { DashboardAppShell } from '@/components/coordinator/dashboard/dashboard-app-shell'
import { DashboardCanvasColumn } from '@/components/coordinator/dashboard/dashboard-canvas-column'
import { DashboardToolbarPortalProvider } from '@/components/coordinator/dashboard/dashboard-toolbar-portal'
import { DashboardToolbarPortalTarget } from '@/components/coordinator/dashboard/dashboard-toolbar-portal'
import { InitialRoomModal } from '@/components/coordinator/dashboard/initial-room-modal'
import { useMarketManagement } from '@/components/coordinator/dashboard/market-management-context'

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
      <DashboardToolbarPortalTarget className="min-h-0 flex-1 overflow-hidden border-b-0 px-1 py-1" />
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
          <DashboardCanvasColumn
            showBlueprint={showBlueprint}
            mountCanvas={Boolean(selectedEventId && hasInitialRoom)}
            reducedMotion={reducedMotion}
            onCanvasInteractive={handleCanvasInteractive}
          />
        }
      />
      {selectedEventId && !hasInitialRoom ? (
        <InitialRoomModal onConfirm={handleInitialRoomConfirm} />
      ) : null}
    </DashboardToolbarPortalProvider>
  )
}

export { InitialRoomModal as InitialRoomModalQa } from '@/components/coordinator/dashboard/initial-room-modal'
