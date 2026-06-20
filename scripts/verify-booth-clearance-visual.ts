/**
 * Booth clearance color bands — 2′ / 3′ / 4′ foot thresholds.
 *
 * Run: npx tsx scripts/verify-booth-clearance-visual.ts
 */

import {
  BOOTH_CLEARANCE_CRITICAL_FT,
  BOOTH_CLEARANCE_GOOD_FT,
  BOOTH_CLEARANCE_THEMES,
  BOOTH_CLEARANCE_TIGHT_FT,
  clearanceBand,
  edgeClearanceBetweenRects,
  minVendorBoothBoundaryClearanceFt,
  minVendorBoothClearanceFt,
  vendorBoothAisleClearanceFt,
  vendorBoothClearanceThemeForProbe,
} from '../lib/coordinator/booth-clearance-visual'
import type { BoothObject, FloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(BOOTH_CLEARANCE_CRITICAL_FT === 2, 'critical threshold must be 2′')
assert(BOOTH_CLEARANCE_TIGHT_FT === 3, 'tight threshold must be 3′')
assert(BOOTH_CLEARANCE_GOOD_FT === 4, 'good threshold must be 4′')

assert(clearanceBand(2) === 'critical', '≤2′ is critical')
assert(clearanceBand(2.5) === 'critical', '<3′ stays critical (red until 3′)')
assert(clearanceBand(3) === 'tight', '≥3′ turns yellow')
assert(clearanceBand(3.5) === 'tight', '3.5′ is tight (not yet 4′ green)')
assert(clearanceBand(4) === 'good', '≥4′ is good')
assert(clearanceBand(Number.POSITIVE_INFINITY) === 'good', 'no neighbors is good')

const a = { x: 0, y: 0, width: 6, height: 4 }
const b = { x: 8, y: 0, width: 6, height: 4 }
assert(edgeClearanceBetweenRects(a, b) === 2, '2′ edge gap between booths')

const topLeft = { x: 0, y: 0, width: 4, height: 2 }
const bottomCenter = { x: 10, y: 20, width: 2, height: 4 }
assert(
  edgeClearanceBetweenRects(topLeft, bottomCenter) === 6,
  'diagonally separated rects use corner clearance, not zero'
)
assert(
  vendorBoothAisleClearanceFt(topLeft, bottomCenter) === Number.POSITIVE_INFINITY,
  'diagonal vendor booths do not share an aisle axis'
)

const roomId = 'room-1'
const doc: FloorPlanDoc = {
  canvasWidthFt: 60,
  canvasLengthFt: 40,
  gridSpacingFt: 1,
  snapFt: 1,
  rooms: [
    {
      id: roomId,
      name: 'Main',
      originX: 10,
      originY: 5,
      widthFt: 40,
      lengthFt: 30,
    },
  ],
  objects: [],
  objectRoom: {},
}

const boothA = {
  id: 'a',
  kind: 'booth',
  x: 20,
  y: 14,
  width: 6,
  height: 4,
  rotation: 0,
  tablePurpose: 'vendor',
} as BoothObject
const boothB = {
  id: 'b',
  kind: 'booth',
  x: 28,
  y: 14,
  width: 6,
  height: 4,
  rotation: 0,
  tablePurpose: 'vendor',
} as BoothObject
doc.objects = [boothA, boothB]
doc.objectRoom = { a: roomId, b: roomId }

const gapA = minVendorBoothClearanceFt(
  boothA,
  doc.objects,
  doc.rooms,
  doc.objectRoom
)
const gapB = minVendorBoothClearanceFt(
  boothB,
  doc.objects,
  doc.rooms,
  doc.objectRoom
)
assert(gapA === 2 && gapB === 2, 'both booths share 2′ neighbor gap')
assert(
  clearanceBand(gapA) === 'critical' && clearanceBand(gapB) === 'critical',
  'both booths flag critical when 2′ apart'
)

// Placement preview — neighbour spacing within 3′–4′ shows yellow.
doc.objects = [boothA]
doc.objectRoom = { a: roomId }
const previewNearVendor = {
  id: '__preview__',
  kind: 'booth',
  x: 29,
  y: 14,
  width: 6,
  height: 4,
  rotation: 0,
  tablePurpose: 'vendor',
} as BoothObject
const previewNearVendorTheme = vendorBoothClearanceThemeForProbe(
  previewNearVendor,
  doc.objects,
  doc.rooms,
  doc.objectRoom,
  roomId
)
assert(
  previewNearVendorTheme.fill === BOOTH_CLEARANCE_THEMES.tight.fill,
  '3′ from another vendor shows yellow (tight) clearance'
)

const previewNearWall = {
  ...previewNearVendor,
  x: 13,
  y: 14,
} as BoothObject
doc.objects = []
doc.objectRoom = {}
const previewNearWallTheme = vendorBoothClearanceThemeForProbe(
  previewNearWall,
  doc.objects,
  doc.rooms,
  doc.objectRoom,
  roomId
)
assert(
  previewNearWallTheme.fill === BOOTH_CLEARANCE_THEMES.tight.fill,
  'preview flush to room wall uses tight (yellow) fill'
)
assert(
  clearanceBand(
    minVendorBoothBoundaryClearanceFt(previewNearWall, doc.objects, doc.rooms, {
      ...doc.objectRoom,
      __preview__: roomId,
    })
  ) === 'tight',
  'preview near room wall is a boundary warning'
)

// Restore paired-booth doc for scatter tests below.
doc.objects = [boothA, boothB]
doc.objectRoom = { a: roomId, b: roomId }

// Scatter layout — diagonally separated booths must not read as 0′ (all red).
{
  const scatterDoc: FloorPlanDoc = {
    canvasWidthFt: 60,
    canvasLengthFt: 60,
    gridSpacingFt: 1,
    snapFt: 1,
    rooms: [
      {
        id: 'scatter-room',
        name: 'Main',
        originX: 0,
        originY: 0,
        widthFt: 36,
        lengthFt: 36,
      },
    ],
    objects: [],
    objectRoom: {},
  }
  const scatterPositions = [
    { id: 's-a', x: 8, y: 8 },
    { id: 's-b', x: 22, y: 14 },
    { id: 's-c', x: 22, y: 24 },
    { id: 's-d', x: 8, y: 28 },
  ]
  for (const p of scatterPositions) {
    const booth = {
      id: p.id,
      kind: 'booth',
      x: p.x,
      y: p.y,
      width: 6,
      height: 2,
      rotation: 0,
      tablePurpose: 'vendor',
    } as BoothObject
    scatterDoc.objects.push(booth)
    scatterDoc.objectRoom![p.id] = 'scatter-room'
  }
  for (const booth of scatterDoc.objects as BoothObject[]) {
    const minFt = minVendorBoothClearanceFt(
      booth,
      scatterDoc.objects,
      scatterDoc.rooms,
      scatterDoc.objectRoom
    )
    assert(
      minFt > 0,
      `${booth.id} must not read as 0′ clearance (diagonal false positive)`
    )
  }
}

// Corner grid — bottom-right must not tint bottom-left via diagonal corner pinch.
{
  const roomId = 'corner-room'
  const room = {
    id: roomId,
    name: 'Main',
    originX: 0,
    originY: 0,
    widthFt: 74,
    lengthFt: 74,
  }
  const mk = (id: string, x: number, y: number) =>
    ({
      id,
      kind: 'booth',
      x,
      y,
      width: 6,
      height: 2,
      rotation: 0,
      tablePurpose: 'vendor',
    }) as BoothObject

  const bottomLeft = mk('bl', 4, 60)
  const bottomRight = mk('br', 58, 62)
  const aboveBottomRight = mk('above-br', 58, 52)
  const objects = [bottomLeft, bottomRight, aboveBottomRight]
  const objectRoom = {
    bl: roomId,
    br: roomId,
    'above-br': roomId,
  }

  assert(
    vendorBoothAisleClearanceFt(
      { x: bottomLeft.x, y: bottomLeft.y, width: bottomLeft.width, height: bottomLeft.height },
      { x: bottomRight.x, y: bottomRight.y, width: bottomRight.width, height: bottomRight.height }
    ) === Number.POSITIVE_INFINITY,
    'bottom-left and bottom-right are diagonal — no shared aisle'
  )

  const bottomLeftGap = minVendorBoothClearanceFt(
    bottomLeft,
    objects,
    [room],
    objectRoom
  )
  assert(
    clearanceBand(bottomLeftGap) !== 'critical',
    'bottom-left must not go red from diagonal bottom-right corner pinch'
  )

  const aboveGap = minVendorBoothClearanceFt(
    aboveBottomRight,
    objects,
    [room],
    objectRoom
  )
  assert(
    clearanceBand(aboveGap) === 'good',
    'booth directly above bottom-right uses vertical aisle clearance only'
  )
}

// Corner booth flush to left + bottom walls must not read as 0′ (red).
{
  const roomId = 'corner-room'
  const room = {
    id: roomId,
    name: 'Main',
    originX: 0,
    originY: 0,
    widthFt: 74,
    lengthFt: 74,
  }
  const cornerBooth = {
    id: 'corner',
    kind: 'booth',
    x: 0,
    y: 72,
    width: 6,
    height: 2,
    rotation: 0,
    tablePurpose: 'vendor',
  } as BoothObject

  const gap = minVendorBoothClearanceFt(
    cornerBooth,
    [cornerBooth],
    [room],
    { corner: roomId }
  )
  assert(
    clearanceBand(gap) === 'good',
    'corner perimeter booth ignores flush left and bottom walls'
  )
}

console.log('verify-booth-clearance-visual: all checks passed')
