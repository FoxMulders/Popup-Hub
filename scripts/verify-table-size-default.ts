/**
 * Smoke verification for the Step 3 baseline table-length selector.
 *
 * The Step 3 floor-plan ribbon hosts the only table-size selector
 * (the Step 2 capacity panel hides its inline copy). Two things
 * have to be true for the wizard to feel correct on first load:
 *
 *   1. Brand-new events default to 6′ tables — `createLayoutRoom`
 *      and `roomsFromBoothLayout` must both seed a Main Hall with
 *      `baseline_table_length_ft = 6`, including legacy migrations
 *      where the saved row predates the field.
 *
 *   2. Changing the size via the ribbon must mutate the active
 *      room's `baseline_table_length_ft` — `updateRoomInList`
 *      (the same helper the wizard's onChange handler calls) has
 *      to produce a room with the requested length so the canvas
 *      footprint math has a fresh value to scale against.
 *
 * Run with: npx tsx scripts/verify-table-size-default.ts
 */

import {
  createLayoutRoom,
  roomsFromBoothLayout,
  updateRoomInList,
} from '../lib/booth-planner/layout-rooms'
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  LAYOUT_BASELINE_TABLE_LENGTHS_FT,
  isLayoutBaselineTableLengthFt,
} from '../lib/booth-planner/layout-table-size'
import type { BoothLayout } from '../types/database'

let pass = 0
let fail = 0

function assert(cond: unknown, msg: string): void {
  if (cond) {
    console.log(`PASS - ${msg}`)
    pass++
  } else {
    console.log(`FAIL - ${msg}`)
    fail++
  }
}

assert(
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT === 6,
  `DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT is 6 (got ${DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT})`
)
assert(
  LAYOUT_BASELINE_TABLE_LENGTHS_FT.includes(6),
  '6 is one of the selectable lengths'
)
assert(
  isLayoutBaselineTableLengthFt(6),
  '6 round-trips through isLayoutBaselineTableLengthFt'
)

const fresh = createLayoutRoom('Main Hall')
assert(
  fresh.baseline_table_length_ft === 6,
  `createLayoutRoom seeds 6′ baseline (got ${fresh.baseline_table_length_ft})`
)

const fromNullLayout = roomsFromBoothLayout(null)
assert(
  fromNullLayout.rooms.length === 1,
  'Null layout produces a single Main Hall'
)
assert(
  fromNullLayout.rooms[0]!.baseline_table_length_ft === 6,
  `Null layout's Main Hall defaults to 6′ (got ${fromNullLayout.rooms[0]!.baseline_table_length_ft})`
)

/*
 * Legacy single-room save — pre-baseline_table_length_ft schema.
 * The migration path must still emit 6′ when the row has no
 * placed cells to infer from.
 */
const legacyLayout = {
  event_id: 'test-event',
  venue_width: 40,
  venue_length: 60,
  booth_width: 1,
  booth_length: 1,
  entrance: 'south',
  spacing_mode: 'one_foot',
  cells: [],
  venue_elements: [],
  layout_rooms: undefined,
  active_room_id: undefined,
} as unknown as BoothLayout

const fromLegacy = roomsFromBoothLayout(legacyLayout)
assert(
  fromLegacy.rooms[0]!.baseline_table_length_ft === 6,
  `Legacy single-room migration falls back to 6′ (got ${fromLegacy.rooms[0]!.baseline_table_length_ft})`
)

/*
 * Layout-rooms-shaped save where one of the rooms is missing the
 * field outright. The migration helper inside roomsFromBoothLayout
 * has to fill it back in with the inferred / default 6′ before
 * the wizard reads it.
 */
const partialMultiRoom = {
  event_id: 'test-event',
  venue_width: 40,
  venue_length: 60,
  booth_width: 1,
  booth_length: 1,
  entrance: 'south',
  spacing_mode: 'one_foot',
  cells: [],
  venue_elements: [],
  layout_rooms: [
    {
      id: 'r1',
      name: 'Main',
      venue_width: 40,
      venue_length: 60,
      booth_width: 1,
      booth_length: 1,
      entrance: 'south',
      spacing_mode: 'one_foot',
      cells: [],
      venue_elements: [],
    },
  ],
  active_room_id: 'r1',
} as unknown as BoothLayout

const fromPartial = roomsFromBoothLayout(partialMultiRoom)
assert(
  fromPartial.rooms[0]!.baseline_table_length_ft === 6,
  `Multi-room save with missing baseline falls back to 6′ (got ${fromPartial.rooms[0]!.baseline_table_length_ft})`
)

/*
 * The wizard's onChange handler is `setRooms((prev) =>
 * updateRoomInList(prev, activeRoomId, { baseline_table_length_ft: ft }))`.
 * Calling it directly should produce a fresh room list whose
 * active room reflects the new length — that's what the canvas
 * pill triggers on every click.
 */
const initial = roomsFromBoothLayout(null).rooms
const after8 = updateRoomInList(initial, initial[0]!.id, {
  baseline_table_length_ft: 8,
})
assert(
  after8[0]!.baseline_table_length_ft === 8,
  `updateRoomInList swaps baseline to 8′ (got ${after8[0]!.baseline_table_length_ft})`
)
assert(
  after8 !== initial,
  'updateRoomInList returns a fresh array (state immutability)'
)

/*
 * Round-tripping every selectable length keeps the type narrow —
 * if a future migration accidentally drops one of the supported
 * values this catches it before it hits the canvas.
 */
for (const ft of LAYOUT_BASELINE_TABLE_LENGTHS_FT) {
  const next = updateRoomInList(initial, initial[0]!.id, {
    baseline_table_length_ft: ft,
  })
  assert(
    next[0]!.baseline_table_length_ft === ft,
    `selectable length ${ft}′ flows through updateRoomInList`
  )
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
