import { hydrateFloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/layout-hydration'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import { roomsFromBoothLayout } from '@/lib/booth-planner/layout-rooms'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import type { BoothLayout } from '@/types/database'

export interface LayoutCategoryCount {
  name: string
  count: number
}

export interface PatronSpaceSummary {
  guestTables: number
  guestRoundTables: number
  guestRectTables: number
  foodTrucks: number
  stages: number
  total: number
}

export interface LayoutTelemetrySummary {
  roomCount: number
  roomNames: string[]
  totalBooths: number
  categories: LayoutCategoryCount[]
  patronSpaces: PatronSpaceSummary
  hasLayout: boolean
}

export function computeLayoutTelemetrySummary(
  eventId: string,
  layout: BoothLayout | null | undefined
): LayoutTelemetrySummary {
  const { rooms } = roomsFromBoothLayout(layout ?? null)
  const hasDrawableRooms = rooms.some((r) => (r.cells?.length ?? 0) > 0)

  if (!hasDrawableRooms) {
    return {
      roomCount: rooms.length,
      roomNames: rooms.map((r) => r.name),
      totalBooths: 0,
      categories: [],
      patronSpaces: {
        guestTables: 0,
        guestRoundTables: 0,
        guestRectTables: 0,
        foodTrucks: 0,
        stages: 0,
        total: 0,
      },
      hasLayout: layout != null && rooms.length > 0,
    }
  }

  const doc = hydrateFloorPlanDoc(eventId, rooms, { preferServerLayout: true })

  let totalBooths = 0
  const categoryCounts = new Map<string, number>()
  let guestRoundTables = 0
  let guestRectTables = 0
  let foodTrucks = 0
  let stages = 0

  for (const obj of doc.objects) {
    if (obj.kind === 'booth') {
      const booth = obj as BoothObject
      if (isGuestTableBooth(booth)) {
        if (booth.tableShape === 'round') guestRoundTables += 1
        else guestRectTables += 1
        continue
      }
      totalBooths += 1
      const cat = booth.categoryName?.trim() || 'Unassigned'
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
    } else if (obj.kind === 'food_truck') {
      foodTrucks += 1
    } else if (obj.kind === 'stage') {
      stages += 1
    }
  }

  const guestTables = guestRoundTables + guestRectTables
  const categories = Array.from(categoryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    roomCount: rooms.length,
    roomNames: rooms.map((r) => r.name),
    totalBooths,
    categories,
    patronSpaces: {
      guestTables,
      guestRoundTables,
      guestRectTables,
      foodTrucks,
      stages,
      total: guestTables + foodTrucks + stages,
    },
    hasLayout: true,
  }
}
