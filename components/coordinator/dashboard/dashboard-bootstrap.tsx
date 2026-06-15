'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { addLayoutRoomToList } from '@/lib/coordinator/dashboard-layout-rooms'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { DashboardAppShell } from './dashboard-app-shell'
import { DashboardLeftPanel } from './dashboard-left-panel'
import { DashboardCanvasColumn } from './dashboard-canvas-column'
import { DashboardNoRoomEmptyState } from './dashboard-no-room-empty-state'
import { DashboardToolbarPortalProvider } from './dashboard-toolbar-portal'
import { useMarketManagement } from './market-management-context'
import {
  DesktopScreenRequiredOverlay,
  FloorPlanDesktopRequiredNotice,
  FloorPlanViewportLayoutProvider,
  useFloorPlanViewportLayout,
} from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'

export interface DashboardBootstrapProps {
  header: ReactNode
}

export function DashboardBootstrap({ header }: DashboardBootstrapProps) {
  return (
    <FloorPlanViewportLayoutProvider>
      <DesktopScreenRequiredOverlay />
      <DashboardBootstrapInner header={header} />
    </FloorPlanViewportLayoutProvider>
  )
}

function DashboardBootstrapInner({ header }: DashboardBootstrapProps) {
  const { showDesktopRequired } = useFloorPlanViewportLayout()
  const { fullscreen: immersive } = useCommandCenterFullscreen()
  const { selectedEventId, layoutRooms, setLayoutRooms } = useMarketManagement()
  const reducedMotion = useReducedMotion()
  const [ariaBusy, setAriaBusy] = useState(true)
  const [liveMessage, setLiveMessage] = useState('Booth layout designer loading.')
  const hasInitialRoom = layoutRooms.length > 0
  const showNoRoomEmpty = Boolean(
    selectedEventId && !hasInitialRoom && !showDesktopRequired
  )

  useEffect(() => {
    if (showNoRoomEmpty) {
      setAriaBusy(false)
      setLiveMessage('Add a room to open the booth layout designer.')
    }
  }, [showNoRoomEmpty])

  const handleInitialRoomConfirm = useCallback(
    (widthFt: number, lengthFt: number) => {
      const { rooms, activeRoomId } = addLayoutRoomToList(layoutRooms, {
        widthFt,
        lengthFt,
      })
      setLayoutRooms(rooms, activeRoomId)
      setAriaBusy(true)
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
        left={immersive ? null : <DashboardLeftPanel />}
        center={
          showDesktopRequired ? (
            <FloorPlanDesktopRequiredNotice />
          ) : showNoRoomEmpty ? (
            <DashboardNoRoomEmptyState onConfirm={handleInitialRoomConfirm} />
          ) : (
            <DashboardCanvasColumn
              showBlueprint={showBlueprint}
              mountCanvas={Boolean(
                selectedEventId && hasInitialRoom && !showDesktopRequired
              )}
              reducedMotion={reducedMotion}
              onCanvasInteractive={handleCanvasInteractive}
            />
          )
        }
      />
    </DashboardToolbarPortalProvider>
  )
}
