'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { FloorPlanV2 } from '@/components/coordinator/floor-plan-v2'
import type { FloorPlanDocStore } from '@/components/coordinator/floor-plan-v2/state/use-floor-plan-doc'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import { rectContainsPoint } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { buttonVariants } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { setSuppressAutoMainHall } from '@/components/coordinator/floor-plan-v2/state/canvas-session-guards'
import {
  addLayoutRoomToList,
  deleteLayoutRoomFromList,
  renameLayoutRoomInList,
} from '@/lib/coordinator/dashboard-layout-rooms'
import {
  resolveDesignerExitHref,
  resolveDesignerExitLabel,
} from '@/components/coordinator/command-center-exit-link'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { useMarketManagement } from './market-management-context'
import { BoothMatrixPanel } from './booth-matrix-panel'
import { DashboardNextStepCta } from './dashboard-next-step-cta'

export interface DashboardFloorPlanViewportProps {
  /** Fired when the CAD canvas store is ready for interaction */
  onInteractive?: () => void
}

export function DashboardFloorPlanViewport({ onInteractive }: DashboardFloorPlanViewportProps) {
  const { previewMode } = useCommandCenterFullscreen()
  const {
    events,
    selectedEventId,
    layoutRooms,
    layoutActiveRoomId,
    setLayoutRooms,
    registerFloorPlanStore,
    boothStatusByObjectId,
    assignVendorToBooth,
    setSelectedBoothId,
    approvedPool,
  } = useMarketManagement()
  const selectedEvent = events.find((event) => event.id === selectedEventId)

  const storeRef = useRef<FloorPlanDocStore | null>(null)
  const [categoryNames, setCategoryNames] = useState<string[]>([])

  useEffect(() => {
    const names = [
      ...new Set(
        approvedPool
          .map((a) => a.categoryName)
          .filter((n): n is string => Boolean(n))
      ),
    ].sort()
    setCategoryNames(names)
  }, [approvedPool])

  const handleStoreReady = useCallback(
    (store: FloorPlanDocStore | null) => {
      storeRef.current = store
      registerFloorPlanStore(store)
      if (store) {
        onInteractive?.()
      }
    },
    [registerFloorPlanStore, onInteractive]
  )

  const handleLayoutRoomsChange = useCallback(
    (rooms: Parameters<typeof setLayoutRooms>[0], activeRoomId: string) => {
      setLayoutRooms(rooms, activeRoomId)
    },
    [setLayoutRooms]
  )

  const handleAddRoom = useCallback(
    (options?: import('@/lib/coordinator/add-layout-room').AddLayoutRoomOptions) => {
      const { rooms, activeRoomId } = addLayoutRoomToList(layoutRooms, options)
      setLayoutRooms(rooms, activeRoomId)
      toast.success(`Added ${rooms.find((r) => r.id === activeRoomId)?.name ?? 'room'}`)
    },
    [layoutRooms, setLayoutRooms]
  )

  const handleRenameRoom = useCallback(
    (roomId: string, name: string) => {
      setLayoutRooms(renameLayoutRoomInList(layoutRooms, roomId, name), layoutActiveRoomId)
    },
    [layoutRooms, layoutActiveRoomId, setLayoutRooms]
  )

  const handleDeleteRoom = useCallback(
    (roomId: string) => {
      const next = deleteLayoutRoomFromList(layoutRooms, roomId, layoutActiveRoomId)
      if (!next) return
      setLayoutRooms(next.rooms, next.activeRoomId)
      if (next.rooms.length === 0) {
        setSuppressAutoMainHall(true, selectedEventId ?? undefined)
      }
      toast.message('Room deleted')
    },
    [layoutRooms, layoutActiveRoomId, selectedEventId, setLayoutRooms]
  )

  const handleSelectRoom = useCallback(
    (roomId: string) => {
      setLayoutRooms(layoutRooms, roomId)
    },
    [layoutRooms, setLayoutRooms]
  )

  const handleSelectionChange = useCallback(
    (store: FloorPlanDocStore) => {
      const first = store.selectedIds.values().next().value as string | undefined
      if (first && store.doc.objects.some((o) => o.id === first && o.kind === 'booth')) {
        setSelectedBoothId(first)
      }
    },
    [setSelectedBoothId]
  )

  const handleVendorDrop = useCallback(
    (applicationId: string, canvasX: number, canvasY: number) => {
      const store = storeRef.current
      if (!store) return
      const application = approvedPool.find((a) => a.id === applicationId)
      if (!application) return

      const target = [...store.doc.objects]
        .reverse()
        .find(
          (obj) =>
            obj.kind === 'booth' &&
            rectContainsPoint(
              { x: obj.x, y: obj.y, width: obj.width, height: obj.height },
              { x: canvasX, y: canvasY }
            )
        )

      if (!target) return
      assignVendorToBooth(target.id, application)
    },
    [approvedPool, assignVendorToBooth]
  )

  const boothStatusMap = useMemo(
    () => new Map(boothStatusByObjectId),
    [boothStatusByObjectId]
  )

  useEffect(() => {
    if (!selectedEventId) onInteractive?.()
  }, [selectedEventId, onInteractive])

  if (!selectedEventId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-muted-foreground">Select a market to open the booth designer.</p>
          <Link
            href="/coordinator/events/new"
            className={cn(buttonVariants({ size: 'sm' }), 'mt-4 gap-1.5')}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create market
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="dashboard-floor-plan-viewport relative flex h-full min-h-0 flex-1 flex-col"
      data-dashboard-preview={previewMode ? 'true' : undefined}
    >
      <FloorPlanV2
        key={selectedEventId}
        variant="dashboard"
        preferServerLayout
        eventId={selectedEventId}
        designerExitHref={resolveDesignerExitHref(
          selectedEventId,
          selectedEvent?.status,
          'auto'
        )}
        designerExitLabel={resolveDesignerExitLabel(
          selectedEvent?.name,
          selectedEvent?.status,
          'auto',
          true
        )}
        designerExitEventStatus={selectedEvent?.status}
        designerExitEventName={selectedEvent?.name}
        layoutRooms={layoutRooms}
        layoutActiveRoomId={layoutActiveRoomId}
        onLayoutRoomsChange={handleLayoutRoomsChange}
        onAddRoom={handleAddRoom}
        onRenameRoom={handleRenameRoom}
        onDeleteRoom={handleDeleteRoom}
        eventCategoryNames={categoryNames}
        applications={approvedPool}
        boothPlacementStatusByObjectId={boothStatusMap}
        onStoreReady={handleStoreReady}
        onSelectionChange={handleSelectionChange}
        onVendorDrop={handleVendorDrop}
        className="min-h-0 flex-1"
      />
      {!previewMode ? (
        <BoothMatrixPanel
          headerAction={<DashboardNextStepCta inline className="max-w-[16rem]" />}
        />
      ) : (
        <BoothMatrixPanel />
      )}
    </div>
  )
}
