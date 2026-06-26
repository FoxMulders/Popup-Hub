import {
  boothEdgeGapsInGridSpaces,
  type BoothFootprintRect,
} from '@/components/coordinator/floor-plan-v2/interactions/category-rules'
import { isVendorBoothObject } from '@/components/coordinator/floor-plan-v2/interactions/vendor-booth-placement'
import type { BoothObject, PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'

/** Soft alert when this many same-category booths cluster in a neighborhood. */
export const CLUSTER_MIN_BOOTH_COUNT = 3

/** Neighborhood radius in grid columns (edge-to-edge). */
export const CLUSTER_RADIUS_COLUMNS = 6

/** Neighborhood radius in grid rows (edge-to-edge). */
export const CLUSTER_RADIUS_ROWS = 3

function normalizeCategory(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

function boothFootprint(booth: BoothObject): BoothFootprintRect {
  return {
    x: booth.x,
    y: booth.y,
    width: booth.width,
    height: booth.height,
  }
}

function boothsInNeighborhood(
  anchor: BoothObject,
  others: BoothObject[],
  gridSpacingFt: number,
  radiusColumns: number,
  radiusRows: number
): BoothObject[] {
  const anchorRect = boothFootprint(anchor)
  const anchorCat = normalizeCategory(anchor.categoryName)
  if (!anchorCat) return []

  const neighbors: BoothObject[] = [anchor]

  for (const other of others) {
    if (other.id === anchor.id) continue
    if (normalizeCategory(other.categoryName) !== anchorCat) continue

    const { dxColumns, dyRows } = boothEdgeGapsInGridSpaces(
      anchorRect,
      boothFootprint(other),
      gridSpacingFt
    )
    if (dxColumns <= radiusColumns && dyRows <= radiusRows) {
      neighbors.push(other)
    }
  }

  return neighbors
}

export interface CategoryClusterAlert {
  categoryName: string
  boothIds: string[]
  boothCount: number
  anchorBoothId: string
}

/**
 * Soft advisory when ≥3 same-category vendor booths fall within a
 * 6-column × 3-row neighborhood (edge-to-edge, grid-spaced).
 */
export function findCategoryClusterAlerts(
  objects: ReadonlyArray<PlacedObject>,
  gridSpacingFt: number,
  options?: {
    minClusterSize?: number
    radiusColumns?: number
    radiusRows?: number
  }
): CategoryClusterAlert[] {
  if (gridSpacingFt <= 0) return []

  const minSize = options?.minClusterSize ?? CLUSTER_MIN_BOOTH_COUNT
  const radiusColumns = options?.radiusColumns ?? CLUSTER_RADIUS_COLUMNS
  const radiusRows = options?.radiusRows ?? CLUSTER_RADIUS_ROWS

  const vendorBooths = objects.filter(
    (obj): obj is BoothObject =>
      obj.kind === 'booth' && isVendorBoothObject(obj as BoothObject)
  )

  const reported = new Set<string>()
  const alerts: CategoryClusterAlert[] = []

  for (const anchor of vendorBooths) {
    const cat = normalizeCategory(anchor.categoryName)
    if (!cat) continue

    const clusterKey = `${cat}:${anchor.id}`
    if (reported.has(clusterKey)) continue

    const neighbors = boothsInNeighborhood(
      anchor,
      vendorBooths,
      gridSpacingFt,
      radiusColumns,
      radiusRows
    )

    if (neighbors.length < minSize) continue

    const boothIds = neighbors.map((b) => b.id).sort()
    const dedupeKey = `${cat}:${boothIds.join(',')}`
    if (reported.has(dedupeKey)) continue
    reported.add(dedupeKey)

    for (const id of boothIds) {
      reported.add(`${cat}:${id}`)
    }

    alerts.push({
      categoryName: anchor.categoryName ?? cat,
      boothIds,
      boothCount: boothIds.length,
      anchorBoothId: anchor.id,
    })
  }

  return alerts.sort((a, b) => b.boothCount - a.boothCount)
}
