import type { LayoutRoom } from '@/types/database'
import { updateRoomInList } from '@/lib/booth-planner/layout-rooms'
import type { LayoutRoomPresetId } from '@/lib/booth-planner/layout-room-presets'
import {
  appendLayoutRoom,
  type AddLayoutRoomOptions,
} from '@/lib/coordinator/add-layout-room'

export type { AddLayoutRoomOptions }

export function addLayoutRoomToList(
  rooms: LayoutRoom[],
  options?: AddLayoutRoomOptions | LayoutRoomPresetId
): { rooms: LayoutRoom[]; activeRoomId: string } {
  const normalized: AddLayoutRoomOptions | undefined =
    typeof options === 'string' ? { presetId: options } : options
  return appendLayoutRoom(rooms, normalized)
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
    activeRoomId: activeRoomId === roomId ? next[0]?.id ?? '' : activeRoomId,
  }
}
