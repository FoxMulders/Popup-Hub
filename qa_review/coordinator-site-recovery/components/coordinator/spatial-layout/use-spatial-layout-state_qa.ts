'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import {
  createLayoutRoom,
  getActiveRoom,
  roomsFromBoothLayout,
  updateRoomInList,
} from '@/lib/booth-planner/layout-rooms'
import {
  LAYOUT_ROOM_PRESETS,
  presetToRoomPartial,
  type LayoutRoomPresetId,
} from '@/lib/booth-planner/layout-room-presets'
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  isLayoutBaselineTableLengthFt,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import {
  calculateMaxBoothCapacity,
  calculateNetUsableFloorSpace,
  boothUnitFootprint,
} from '@/lib/booth-planner/smart-populate-booth-caps'
import { resolveTemplateAnchoredDimensions } from '@/lib/booth-planner/venue-presets'
import type { VenuePresetId } from '@/lib/booth-planner/venue-presets'
import { setSuppressAutoMainHall } from '@/components/coordinator/floor-plan-v2/state/canvas-session-guards'
import type { BoothLayout, Event, LayoutRoom } from '@/types/database'

export interface UseSpatialLayoutStateOptions {
  event: Event
  existingLayout: BoothLayout | null
}

export function useSpatialLayoutState({
  event,
  existingLayout,
}: UseSpatialLayoutStateOptions) {
  const initial = useMemo(() => {
    if (existingLayout == null) {
      return { rooms: [] as LayoutRoom[], activeRoomId: '' }
    }
    return roomsFromBoothLayout(existingLayout)
  }, [existingLayout])

  const allowEmptyRooms = existingLayout == null

  const [rooms, setRooms] = useState(initial.rooms)
  const [activeRoomId, setActiveRoomId] = useState(initial.activeRoomId)

  const activeRoom = useMemo(() => {
    if (rooms.length === 0) {
      return createLayoutRoom('Room', { venue_width: 50, venue_length: 50 })
    }
    return getActiveRoom(rooms, activeRoomId)
  }, [rooms, activeRoomId])

  const venuePresetId: VenuePresetId =
    (activeRoom.venue_preset_id as VenuePresetId | null | undefined) ?? 'blank'

  const templateAnchor = useMemo(
    () =>
      resolveTemplateAnchoredDimensions(
        venuePresetId,
        activeRoom.venue_width,
        activeRoom.venue_length
      ),
    [venuePresetId, activeRoom.venue_width, activeRoom.venue_length]
  )

  const baselineTableLengthFt: LayoutBaselineTableLengthFt = useMemo(() => {
    const ft = activeRoom.baseline_table_length_ft
    if (ft != null && isLayoutBaselineTableLengthFt(ft)) return ft
    return DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
  }, [activeRoom.baseline_table_length_ft])

  const eventCategoryNames = useMemo(() => {
    const limits = (
      event as Event & {
        category_limits?: Array<{ category?: { name?: string } }>
      }
    ).category_limits
    return (limits ?? [])
      .map((cl) => cl.category?.name?.trim())
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b))
  }, [event])

  const layoutCapacity = useMemo(() => {
    const floor = calculateNetUsableFloorSpace(templateAnchor.width, templateAnchor.length, {
      venueElements: activeRoom.venue_elements,
      entrance: activeRoom.entrance,
    })
    const footprint = boothUnitFootprint(baselineTableLengthFt)
    return calculateMaxBoothCapacity(floor.netUsableSqFt, footprint.sqFt)
  }, [templateAnchor, activeRoom.venue_elements, activeRoom.entrance, baselineTableLengthFt])

  const handleLayoutRoomsChange = useCallback(
    (nextRooms: LayoutRoom[], nextActiveRoomId: string) => {
      setRooms(nextRooms)
      setActiveRoomId(nextActiveRoomId)
    },
    []
  )

  const handleAddRoom = useCallback((presetId?: LayoutRoomPresetId) => {
    const preset =
      LAYOUT_ROOM_PRESETS.find((p) => p.id === presetId) ?? LAYOUT_ROOM_PRESETS[0]!
    const isFirstRoom = rooms.length === 0
    let name: string
    if (preset.id !== 'blank') {
      name = preset.name
    } else if (isFirstRoom) {
      name = 'Main Hall'
    } else {
      name = `Room ${rooms.length + 1}`
    }
    const partial = presetToRoomPartial(preset)
    let nextOriginX = 0
    const nextOriginY = 0
    if (!isFirstRoom) {
      let maxRight = 0
      for (const r of rooms) {
        const right = (r.canvas_origin_x ?? 0) + (r.venue_width || 50)
        if (right > maxRight) maxRight = right
      }
      nextOriginX = maxRight + 4
    }
    const room = createLayoutRoom(name, {
      ...partial,
      canvas_origin_x: nextOriginX,
      canvas_origin_y: nextOriginY,
    })
    setRooms((prev) => [...prev, room])
    setActiveRoomId(room.id)
    toast.success(`Added ${room.name}`)
  }, [rooms])

  const handleRenameRoom = useCallback((roomId: string, name: string) => {
    setRooms((prev) => updateRoomInList(prev, roomId, { name }))
  }, [])

  const handleDeleteRoom = useCallback(
    (roomId: string) => {
      if (rooms.length <= 1) {
        toast.error('At least one room is required')
        return
      }
      const room = rooms.find((r) => r.id === roomId)
      if (
        !window.confirm(
          `Delete "${room?.name ?? 'this room'}"? Its booths and fixtures will be removed.`
        )
      ) {
        return
      }
      const next = rooms.filter((r) => r.id !== roomId)
      setRooms(next)
      if (activeRoomId === roomId) {
        setActiveRoomId(next[0]?.id ?? '')
      }
      if (next.length === 0) {
        setSuppressAutoMainHall(true, event.id)
      }
      toast.message('Room deleted')
    },
    [rooms, activeRoomId, allowEmptyRooms]
  )

  const handleBaselineTableLengthChange = useCallback(
    (ft: LayoutBaselineTableLengthFt) => {
      setRooms((prev) =>
        updateRoomInList(prev, activeRoomId, { baseline_table_length_ft: ft })
      )
    },
    [activeRoomId]
  )

  return {
    rooms,
    activeRoomId,
    activeRoom,
    baselineTableLengthFt,
    eventCategoryNames,
    layoutCapacity,
    handleLayoutRoomsChange,
    handleAddRoom,
    handleRenameRoom,
    handleDeleteRoom,
    handleBaselineTableLengthChange,
  }
}
