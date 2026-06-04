import type { LayoutRoom } from '@/types/database'
import {
  createLayoutRoom,
} from '@/lib/booth-planner/layout-rooms'
import {
  LAYOUT_ROOM_PRESETS,
  presetToRoomPartial,
  type LayoutRoomPresetId,
} from '@/lib/booth-planner/layout-room-presets'
import { MIN_ROOM_DIMENSION_FT } from '@/components/coordinator/floor-plan-v2/state/room-canvas'

export type AddLayoutRoomOptions = {
  presetId?: LayoutRoomPresetId
  widthFt?: number
  lengthFt?: number
}

function clampRoomDimensionFt(value: number | undefined, fallback: number): number {
  const n = value ?? fallback
  return Math.max(MIN_ROOM_DIMENSION_FT, Math.round(n))
}

/**
 * Append a layout room using an optional preset and/or explicit footprint.
 */
export function appendLayoutRoom(
  rooms: LayoutRoom[],
  options?: AddLayoutRoomOptions
): { rooms: LayoutRoom[]; activeRoomId: string } {
  const preset =
    LAYOUT_ROOM_PRESETS.find((p) => p.id === options?.presetId) ??
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
  const widthFt = clampRoomDimensionFt(
    options?.widthFt,
    partial.venue_width ?? preset.width
  )
  const lengthFt = clampRoomDimensionFt(
    options?.lengthFt,
    partial.venue_length ?? preset.length
  )
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
    venue_width: widthFt,
    venue_length: lengthFt,
    canvas_origin_x: nextOriginX,
    canvas_origin_y: nextOriginY,
  })
  return {
    rooms: [...rooms, room],
    activeRoomId: room.id,
  }
}
