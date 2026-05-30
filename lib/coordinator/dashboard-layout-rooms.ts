import { toast } from 'sonner'
import type { LayoutRoom } from '@/types/database'
import {
  createLayoutRoom,
  updateRoomInList,
} from '@/lib/booth-planner/layout-rooms'
import {
  LAYOUT_ROOM_PRESETS,
  presetToRoomPartial,
  type LayoutRoomPresetId,
} from '@/lib/booth-planner/layout-room-presets'

export function addLayoutRoomToList(
  rooms: LayoutRoom[],
  presetId?: LayoutRoomPresetId
): { rooms: LayoutRoom[]; activeRoomId: string } {
  const preset =
    LAYOUT_ROOM_PRESETS.find((p) => p.id === presetId) ??
    LAYOUT_ROOM_PRESETS[0]!
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
  return {
    rooms: [...rooms, room],
    activeRoomId: room.id,
  }
}

export function renameLayoutRoomInList(
  rooms: LayoutRoom[],
  roomId: string,
  name: string
): LayoutRoom[] {
  return updateRoomInList(rooms, roomId, { name })
}

export function deleteLayoutRoomFromList(
  rooms: LayoutRoom[],
  roomId: string,
  activeRoomId: string
): { rooms: LayoutRoom[]; activeRoomId: string } | null {
  if (rooms.length <= 1) {
    toast.error('At least one room is required')
    return null
  }
  const room = rooms.find((r) => r.id === roomId)
  if (
    !window.confirm(
      `Delete "${room?.name ?? 'this room'}"? Its booths and fixtures will be removed.`
    )
  ) {
    return null
  }
  const next = rooms.filter((r) => r.id !== roomId)
  return {
    rooms: next,
    activeRoomId: activeRoomId === roomId ? next[0]!.id : activeRoomId,
  }
}
