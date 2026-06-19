'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
  type RefObject,
} from 'react'
import { clearMultiRoomDraft } from '@/components/coordinator/floor-plan-v2/state/local-draft'
import { SavedLayoutPicker } from '@/components/coordinator/saved-layout-picker'
import type { LayoutRoom } from '@/types/database'
import { useMarketManagement } from './market-management-context'

export type LayoutSnapshotGetter = () => {
  rooms: LayoutRoom[]
  activeRoomId: string
} | null

const LayoutSnapshotRefContext = createContext<RefObject<LayoutSnapshotGetter | null> | null>(
  null
)

export { LayoutSnapshotRefContext }

export function LayoutSnapshotRefProvider({
  layoutSnapshotRef,
  children,
}: {
  layoutSnapshotRef: RefObject<LayoutSnapshotGetter | null>
  children: ReactNode
}) {
  const value = useMemo(() => layoutSnapshotRef, [layoutSnapshotRef])
  return (
    <LayoutSnapshotRefContext.Provider value={value}>
      {children}
    </LayoutSnapshotRefContext.Provider>
  )
}

export interface DashboardSavedLayoutToolbarProps {
  coordinatorId: string
}

export function DashboardSavedLayoutToolbar({ coordinatorId }: DashboardSavedLayoutToolbarProps) {
  const snapshotRef = useContext(LayoutSnapshotRefContext)
  const { selectedEventId, events, layoutRooms, layoutActiveRoomId, setLayoutRooms } =
    useMarketManagement()

  const selectedEvent = events.find((event) => event.id === selectedEventId)
  const locationName = selectedEvent?.location_name ?? ''
  const address = selectedEvent?.address ?? ''

  const getLayoutSnapshot = useCallback(() => {
    const fromRef = snapshotRef?.current?.()
    if (fromRef) return fromRef
    if (layoutRooms.length === 0) return null
    return { rooms: layoutRooms, activeRoomId: layoutActiveRoomId }
  }, [layoutActiveRoomId, layoutRooms, snapshotRef])

  const handleApplySavedLayout = useCallback(
    (rooms: LayoutRoom[], activeRoomId: string) => {
      if (selectedEventId) clearMultiRoomDraft(selectedEventId)
      setLayoutRooms(rooms, activeRoomId)
    },
    [selectedEventId, setLayoutRooms]
  )

  if (!selectedEventId) return null

  return (
    <SavedLayoutPicker
      coordinatorId={coordinatorId}
      locationName={locationName}
      address={address}
      getLayoutSnapshot={getLayoutSnapshot}
      onApplyLayout={handleApplySavedLayout}
      compact
      className="shrink-0"
    />
  )
}
