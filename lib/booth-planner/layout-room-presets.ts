/**
 * Auxiliary-room presets for the floor-plan canvas.
 *
 * Coordinators frequently host events that spill outside the Main Hall
 * — a kitchen prep area off to the side, an outdoor stage on the
 * sidewalk, an annex room for overflow vendors. Forcing them to drag a
 * generic "Room N" into the canvas every time and resize from 50×50
 * adds friction.
 *
 * Each preset here ships with a sensible default footprint plus a
 * starter `venue_elements` list, so dropping in a "Kitchen Area" or an
 * "Outdoor Stage" produces a recognisable room that the user can then
 * fill with vendor booths.
 *
 * Presets are pure data — `createLayoutRoom(name, partial)` from
 * `layout-rooms.ts` does the actual room construction so all the
 * defaults (id generation, baseline_table_length_ft, spacing_mode,
 * etc.) stay in one place.
 */

import type { LayoutRoom, VenueElement } from '@/types/database'

export type LayoutRoomPresetId =
  | 'blank'
  | 'kitchen'
  | 'outdoor_stage'
  | 'annex'

export interface LayoutRoomPreset {
  id: LayoutRoomPresetId
  /** Default room name when this preset is added. */
  name: string
  /** Short description shown in the preset picker. */
  description: string
  /** Default canvas footprint in feet (advisory; user can resize). */
  width: number
  length: number
  /**
   * Pre-baked venue elements that should appear inside the room when
   * it's first created. Keep these conservative — the preset only
   * seeds *structural* fixtures, never vendor booths.
   */
  seedVenueElements?: ReadonlyArray<Omit<VenueElement, 'id'>>
}

/**
 * The "Add room" picker is sorted in this exact order. `blank` stays
 * first so the existing zero-config behaviour is still one click away.
 */
export const LAYOUT_ROOM_PRESETS: ReadonlyArray<LayoutRoomPreset> = [
  {
    id: 'blank',
    name: 'Empty room',
    description: 'Blank 50×50 ft canvas. No seeded fixtures.',
    width: 50,
    length: 50,
  },
  {
    id: 'kitchen',
    name: 'Kitchen Area',
    description: 'Compact 30×24 ft prep zone with a back-of-house exit.',
    width: 30,
    length: 24,
    seedVenueElements: [
      // Single rear emergency exit so vendors and staff have a clear
      // back-of-house egress out of the box. The label sentinel
      // (`EMERGENCY:`) is the round-trip marker used by the
      // floor-plan-v2 legacy bridge so this shows up as a proper
      // emergency exit fixture, not a generic door.
      {
        type: 'exit',
        col: 14,
        row: 0,
        colSpan: 4,
        rowSpan: 1,
        label: 'EMERGENCY:Back exit',
      },
    ],
  },
  {
    id: 'outdoor_stage',
    name: 'Outdoor Stage',
    description: 'Open 60×30 ft sidewalk patio with a centred stage.',
    width: 60,
    length: 30,
    seedVenueElements: [
      {
        type: 'stage',
        col: 22,
        row: 4,
        colSpan: 16,
        rowSpan: 8,
        label: 'Main stage',
      },
    ],
  },
  {
    id: 'annex',
    name: 'Annex Room',
    description: 'Overflow vendor space, 40×40 ft. Mirrors Main Hall feel.',
    width: 40,
    length: 40,
    seedVenueElements: [
      // A connecting "entrance" door so coordinators can see at a
      // glance how the annex links to the main hall.
      {
        type: 'entrance',
        col: 18,
        row: 0,
        colSpan: 4,
        rowSpan: 1,
        label: 'From hall',
      },
    ],
  },
]

/**
 * Convert a preset into the shape `createLayoutRoom`'s `partial` arg
 * accepts, with seed fixtures already given fresh ids. Pure helper
 * (no `crypto` usage out at module load — that's deferred until call
 * time so SSR doesn't trip).
 */
export function presetToRoomPartial(
  preset: LayoutRoomPreset
): Partial<LayoutRoom> {
  const venue_elements: VenueElement[] =
    preset.seedVenueElements?.map((el) => ({
      ...el,
      id: `el-${crypto.randomUUID()}`,
    })) ?? []
  return {
    venue_width: preset.width,
    venue_length: preset.length,
    venue_elements,
  }
}
