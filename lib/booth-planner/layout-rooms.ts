import type { BoothCell, BoothLayout, LayoutRoom, LayoutSpacingMode, VenueElement } from '@/types/database'
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  inferBaselineTableLengthFromCells,
} from '@/lib/booth-planner/layout-table-size'
import { migrateRoomToCurrentPreset } from '@/lib/booth-planner/venue-presets'
import { MAIN_HALL_ROOM_ID } from '@/components/coordinator/floor-plan-v2/state/canvas-init'

export type { LayoutRoom }

export function createLayoutRoom(name: string, partial?: Partial<LayoutRoom>): LayoutRoom {
  return {
    id: crypto.randomUUID(),
    name,
    venue_width: 50,
    venue_length: 50,
    booth_width: 1,
    booth_length: 1,
    entrance: 'south',
    spacing_mode: 'one_foot',
    baseline_table_length_ft: DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
    cells: [],
    venue_elements: [],
    ...partial,
  }
}

/** Build room list from saved layout (migrates legacy single-room rows). */
export function roomsFromBoothLayout(layout: BoothLayout | null): {
  rooms: LayoutRoom[]
  activeRoomId: string
} {
  const saved = layout?.layout_rooms
  if (Array.isArray(saved) && saved.length > 0) {
    const rooms = (saved as LayoutRoom[]).map((r) =>
      migrateRoomToCurrentPreset({
        ...r,
        baseline_table_length_ft:
          r.baseline_table_length_ft ?? inferBaselineTableLengthFromCells(r.cells ?? []),
      })
    )
    const activeId =
      layout?.active_room_id && rooms.some((r) => r.id === layout.active_room_id)
        ? layout.active_room_id
        : rooms[0].id
    return { rooms, activeRoomId: activeId }
  }

  if (layout) {
    const legacyCells = layout.cells ?? []
    const main = migrateRoomToCurrentPreset(
      createLayoutRoom('Main Hall', {
        id: crypto.randomUUID(),
        venue_width: layout.venue_width,
        venue_length: layout.venue_length,
        booth_width: layout.booth_width,
        booth_length: layout.booth_length,
        entrance: layout.entrance,
        spacing_mode:
          layout.spacing_mode === 'standard' || layout.spacing_mode == null
            ? 'one_foot'
            : layout.spacing_mode,
        baseline_table_length_ft: inferBaselineTableLengthFromCells(legacyCells),
        cells: legacyCells,
        venue_elements: layout.venue_elements ?? [],
      })
    )
    return { rooms: [main], activeRoomId: main.id }
  }

  const main = createLayoutRoom('Main Hall', { id: MAIN_HALL_ROOM_ID })
  return { rooms: [main], activeRoomId: main.id }
}

export function getActiveRoom(rooms: LayoutRoom[], activeRoomId: string): LayoutRoom {
  return rooms.find((r) => r.id === activeRoomId) ?? rooms[0]
}

export function updateRoomInList(
  rooms: LayoutRoom[],
  roomId: string,
  patch: Partial<LayoutRoom>
): LayoutRoom[] {
  return rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r))
}

/** Flatten active room onto booth_layouts row for check-in and legacy reads. */
export function layoutPayloadFromRooms(
  eventId: string,
  rooms: LayoutRoom[],
  activeRoomId: string
): Record<string, unknown> {
  const active = getActiveRoom(rooms, activeRoomId)
  return {
    event_id: eventId,
    venue_width: active.venue_width,
    venue_length: active.venue_length,
    booth_width: active.booth_width,
    booth_length: active.booth_length,
    entrance: active.entrance,
    spacing_mode: active.spacing_mode,
    cells: active.cells,
    venue_elements: active.venue_elements,
    layout_rooms: rooms,
    active_room_id: activeRoomId,
    updated_at: new Date().toISOString(),
  }
}
