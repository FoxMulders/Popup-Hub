'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { addLayoutRoomToList } from '@/lib/coordinator/dashboard-layout-rooms'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { DashboardAppShell } from './dashboard-app-shell'
import { DashboardLeftPanel } from './dashboard-left-panel'
import { DashboardCanvasColumn } from './dashboard-canvas-column'
import { DashboardToolbarPortalProvider } from './dashboard-toolbar-portal'
import { InitialRoomModal } from './initial-room-modal'
import { useMarketManagement } from './market-management-context'

export interface DashboardBootstrapProps {
  header: ReactNode
}

export function DashboardBootstrap({ header }: DashboardBootstrapProps) {
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
      const { rooms, activeRoomId } = addLayoutRoomToList(layoutRooms, {
        widthFt,
        lengthFt,
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
        leftClassName="flex w-[300px] min-w-[300px] flex-shrink-0 flex-col justify-start overflow-hidden border-r border-gray-200 bg-white lg:h-[calc(100vh-64px)]"
        left={<DashboardLeftPanel />}
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
