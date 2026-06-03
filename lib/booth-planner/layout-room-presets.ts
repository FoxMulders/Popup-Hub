/**
 * Auxiliary-room presets for the floor-plan canvas.
 *
 * Coordinators frequently host events that spill outside the Main Hall
 * — a kitchen prep area off to the side, an outdoor stage on the
 * sidewalk, an annex room for overflow vendors. Forcing them to drag a
 * generic "Room N" into the canvas every time and resize from 50×50
 * adds friction.
 *
 * Each preset ships with a sensible default footprint only — interiors
 * start blank so coordinators place fixtures and booths manually.
 *
 * Presets are pure data — `createLayoutRoom(name, partial)` from
 * `layout-rooms.ts` does the actual room construction so all the
 * defaults (id generation, baseline_table_length_ft, spacing_mode,
 * etc.) stay in one place.
 */

import type { LayoutRoom } from '@/types/database'

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
    description: 'Compact 30×24 ft prep zone. No seeded fixtures.',
    width: 30,
    length: 24,
  },
  {
    id: 'outdoor_stage',
    name: 'Outdoor Stage',
    description: 'Open 60×30 ft sidewalk patio. No seeded fixtures.',
    width: 60,
    length: 30,
  },
  {
    id: 'annex',
    name: 'Annex Room',
    description: 'Overflow vendor space, 40×40 ft. No seeded fixtures.',
    width: 40,
    length: 40,
  },
]

/** Convert a preset into the shape `createLayoutRoom`'s `partial` arg accepts. */
export function presetToRoomPartial(
  preset: LayoutRoomPreset
): Partial<LayoutRoom> {
  return {
    venue_width: preset.width,
    venue_length: preset.length,
    venue_elements: [],
  }
}
