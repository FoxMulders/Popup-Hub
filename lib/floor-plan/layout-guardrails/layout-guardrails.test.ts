/**
 * Unit checks for layout guardrails — run:
 *   npx tsx lib/floor-plan/layout-guardrails/layout-guardrails.test.ts
 */
import assert from 'node:assert/strict'
import {
  MELT_ZONE_BUFFER_FT,
  findMeltZoneViolation,
  isHeatSourceObject,
  isMeltSensitiveCategory,
  listHeatProximityIssues,
  listMeltZoneIssues,
} from './melt-zone-rules'
import {
  CLUSTER_MIN_BOOTH_COUNT,
  findCategoryClusterAlerts,
} from './category-cluster-alerts'
import {
  docHasOutdoorVenue,
  findOutdoorExposureIssue,
  listOutdoorExposureIssues,
} from './outdoor-exposure-rules'
import type { BoothObject, FloorPlanDoc, PlacedObject, RoomFrame } from '@/components/coordinator/floor-plan-v2/state/types'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

function booth(
  id: string,
  x: number,
  y: number,
  category: string | null,
  overrides: Partial<BoothObject> = {}
): BoothObject {
  return {
    id,
    kind: 'booth',
    x,
    y,
    width: 6,
    height: 6,
    rotation: 0,
    accentColor: null,
    categoryName: category,
    tablePurpose: 'vendor',
    ...overrides,
  }
}

function foodTruck(id: string, x: number, y: number): PlacedObject {
  return {
    id,
    kind: 'food_truck',
    x,
    y,
    width: 8,
    height: 20,
    rotation: 0,
  }
}

function outdoorDoc(objects: PlacedObject[], rooms?: RoomFrame[]): FloorPlanDoc {
  return {
    canvasWidthFt: 120,
    canvasLengthFt: 80,
    gridSpacingFt: 1,
    snapFt: 1,
    objects,
    rooms: rooms ?? [
      {
        id: 'outdoor-hall',
        name: 'Covered hall',
        originX: 10,
        originY: 10,
        widthFt: 40,
        lengthFt: 30,
        venueProfile: 'outdoor',
      },
    ],
  }
}

console.log('layout-guardrails tests')

test('melt-sensitive category matchers', () => {
  assert.equal(isMeltSensitiveCategory('Candles & Wax Melts'), true)
  assert.equal(isMeltSensitiveCategory('Soaps & Body Care'), true)
  assert.equal(isMeltSensitiveCategory('Ceramics & Pottery'), false)
})

test('food truck is a heat source', () => {
  assert.equal(isHeatSourceObject(foodTruck('ft1', 0, 0)), true)
})

test('melt-zone violation when candles booth is adjacent to food truck', () => {
  const objects: PlacedObject[] = [
    foodTruck('ft1', 0, 0),
    booth('b1', 10, 0, 'Candles & Wax Melts'),
  ]
  const issue = findMeltZoneViolation(objects[1] as BoothObject, objects)
  assert.ok(issue)
  assert.equal(issue!.kind, 'heat_proximity')
  assert.equal(issue!.heatSourceId, 'ft1')
  assert.ok(issue!.clearanceFt < MELT_ZONE_BUFFER_FT)
})

test('no melt-zone violation when candles booth is far from food truck', () => {
  const objects: PlacedObject[] = [
    foodTruck('ft1', 0, 0),
    booth('b1', 30, 0, 'Candles & Wax Melts'),
  ]
  assert.equal(findMeltZoneViolation(objects[1] as BoothObject, objects), null)
})

test('listHeatProximityIssues returns sorted issues', () => {
  const objects: PlacedObject[] = [
    foodTruck('ft1', 0, 0),
    booth('b1', 10, 0, 'Candles & Wax Melts'),
    booth('b2', 12, 8, 'Chocolate Treats'),
  ]
  const issues = listHeatProximityIssues(objects)
  assert.equal(issues.length, 2)
})

test('outdoor vendor booth outside rooms triggers exposure advisory', () => {
  const doc = outdoorDoc([booth('b1', 0, 0, 'Jewelry')])
  assert.equal(docHasOutdoorVenue(doc), true)
  const issue = findOutdoorExposureIssue(doc, doc.objects[0] as BoothObject)
  assert.ok(issue)
  assert.equal(listOutdoorExposureIssues(doc).length, 1)
})

test('vendor booth inside outdoor room has no exposure advisory', () => {
  const doc = outdoorDoc([booth('b1', 20, 20, 'Jewelry')])
  assert.equal(findOutdoorExposureIssue(doc, doc.objects[0] as BoothObject), null)
})

test('listMeltZoneIssues merges heat and outdoor exposure', () => {
  const doc = outdoorDoc([
    foodTruck('ft1', 0, 0),
    booth('b1', 10, 0, 'Candles & Wax Melts'),
    booth('b2', 0, 30, 'Ceramics'),
  ])
  const issues = listMeltZoneIssues(doc)
  assert.equal(issues.length, 2)
  assert.ok(issues.some((i) => i.kind === 'heat_proximity'))
  assert.ok(issues.some((i) => i.kind === 'outdoor_exposure'))
})

test('cluster alert when 3 same-category booths in neighborhood', () => {
  const objects: PlacedObject[] = [
    booth('b1', 0, 0, 'Jewelry'),
    booth('b2', 8, 0, 'Jewelry'),
    booth('b3', 0, 8, 'Jewelry'),
    booth('b4', 30, 0, 'Ceramics'),
  ]
  const alerts = findCategoryClusterAlerts(objects, 1)
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0]!.boothCount, CLUSTER_MIN_BOOTH_COUNT)
  assert.equal(alerts[0]!.categoryName, 'Jewelry')
})

test('no cluster alert when only 2 same-category booths', () => {
  const objects: PlacedObject[] = [
    booth('b1', 0, 0, 'Jewelry'),
    booth('b2', 8, 0, 'Jewelry'),
  ]
  assert.equal(findCategoryClusterAlerts(objects, 1).length, 0)
})

console.log('\nAll layout-guardrails tests passed.')
