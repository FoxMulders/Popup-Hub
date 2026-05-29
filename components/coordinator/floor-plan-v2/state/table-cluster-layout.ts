/**
 * Multi-table cluster presets (2×5′, 2×6′, 3×5′, 3×6′) with per-sub-table
 * rotation. One `BoothObject` = one joined vendor unit; sub-tables are
 * layout children in cluster-local feet relative to the pivot.
 */

import {
  objectCenter,
  rotatePointAround,
  rotatedAabb,
  type Point,
  type Rect,
} from '../interactions/geometry'
import {
  isLayoutBaselineTableLengthFt,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import { BOOTH_EQUIPMENT_DEPTH_FT } from '@/lib/booth-planner/table-space'
import type { BoothObject, PlacedObject } from './types'

/** Gap between sub-table footprints along a row (ft). */
export const TABLE_CLUSTER_GAP_FT = 2

export type {
  BoothSubTable,
  BoothTableCluster,
  TableClusterPresetId,
} from './table-cluster-types'

import type {
  BoothSubTable,
  BoothTableCluster,
  TableClusterPresetId,
} from './table-cluster-types'

export const TABLE_CLUSTER_PRESET_IDS: readonly TableClusterPresetId[] = [
  '2x5',
  '2x6',
  '3x5',
  '3x6',
] as const

export function isTableClusterPresetId(id: string): id is TableClusterPresetId {
  return (TABLE_CLUSTER_PRESET_IDS as readonly string[]).includes(id)
}

export function tableCountForPreset(presetId: TableClusterPresetId): number {
  return presetId.startsWith('3') ? 3 : 2
}

export function tableLengthFtForPreset(
  presetId: TableClusterPresetId
): LayoutBaselineTableLengthFt {
  const ft = presetId.endsWith('6') ? 6 : 5
  return ft as LayoutBaselineTableLengthFt
}

export function inferClusterPreset(
  tableCount: number,
  tableLengthFt: number
): TableClusterPresetId | null {
  const len = isLayoutBaselineTableLengthFt(tableLengthFt)
    ? tableLengthFt
    : null
  if (len == null) return null
  if (tableCount === 2 && len === 5) return '2x5'
  if (tableCount === 2 && len === 6) return '2x6'
  if (tableCount === 3 && len === 5) return '3x5'
  if (tableCount === 3 && len === 6) return '3x6'
  return null
}

/** Default linear row layout in cluster-local coordinates (pivot at centroid). */
export function defaultSubTablesForPreset(
  presetId: TableClusterPresetId
): BoothSubTable[] {
  const tableLengthFt = tableLengthFtForPreset(presetId)
  const n = tableCountForPreset(presetId)
  const step = tableLengthFt + TABLE_CLUSTER_GAP_FT
  const totalSpan = (n - 1) * step
  const subTables: BoothSubTable[] = []
  for (let i = 0; i < n; i++) {
    subTables.push({
      id: `t${i}`,
      localCenterX: -totalSpan / 2 + i * step,
      localCenterY: 0,
      tableLengthFt,
      rotationOffsetDeg: 0,
    })
  }
  return subTables
}

export function createTableCluster(
  presetId: TableClusterPresetId
): BoothTableCluster {
  const tableLengthFt = tableLengthFtForPreset(presetId)
  return {
    presetId,
    tableLengthFt,
    subTables: defaultSubTablesForPreset(presetId),
  }
}

function normalizeDeg(d: number): number {
  let x = d % 360
  if (x > 180) x -= 360
  if (x <= -180) x += 360
  return x
}

/** World-space center of the cluster pivot. */
export function clusterPivotWorld(booth: BoothObject): Point {
  return objectCenter(booth)
}

/**
 * World footprint for one sub-table (synthetic booth-shaped probe).
 */
export function subTableWorldProbe(
  booth: BoothObject,
  sub: BoothSubTable
): PlacedObject {
  const pivot = clusterPivotWorld(booth)
  const clusterRot = booth.rotation ?? 0
  const totalRot = normalizeDeg(clusterRot + sub.rotationOffsetDeg)
  const localCenter = rotatePointAround(
    { x: sub.localCenterX, y: sub.localCenterY },
    { x: 0, y: 0 },
    clusterRot
  )
  const center: Point = {
    x: pivot.x + localCenter.x,
    y: pivot.y + localCenter.y,
  }
  const w = sub.tableLengthFt
  const h = BOOTH_EQUIPMENT_DEPTH_FT
  return {
    id: `${booth.id}::${sub.id}`,
    kind: 'booth',
    x: center.x - w / 2,
    y: center.y - h / 2,
    width: w,
    height: h,
    rotation: totalRot,
    accentColor: null,
  }
}

/** All sub-table probes for overlap / validation. */
export function subTableWorldProbes(booth: BoothObject): PlacedObject[] {
  if (!booth.tableCluster?.subTables.length) return [booth]
  return booth.tableCluster.subTables.map((sub) =>
    subTableWorldProbe(booth, sub)
  )
}

/** Union of rotated AABBs for every sub-table. */
export function compoundBoundsFromCluster(
  booth: BoothObject,
  pivotWorld?: Point
): Rect {
  const probes = subTableWorldProbes(booth)
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const probe of probes) {
    const aabb = rotatedAabb(probe)
    minX = Math.min(minX, aabb.x)
    minY = Math.min(minY, aabb.y)
    maxX = Math.max(maxX, aabb.x + aabb.width)
    maxY = Math.max(maxY, aabb.y + aabb.height)
  }
  if (!Number.isFinite(minX)) {
    const p = pivotWorld ?? clusterPivotWorld(booth)
    return { x: p.x - 3, y: p.y - 1, width: 6, height: 2 }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Recompute parent AABB from sub-tables while keeping the cluster pivot
 * fixed in world space (preserves drag / join group integrity).
 */
export function syncBoothCompoundBounds(booth: BoothObject): BoothObject {
  if (!booth.tableCluster) return booth
  const pivot = clusterPivotWorld(booth)
  const bounds = compoundBoundsFromCluster(booth, pivot)
  return {
    ...booth,
    x: pivot.x - bounds.width / 2,
    y: pivot.y - bounds.height / 2,
    width: bounds.width,
    height: bounds.height,
    tableCount: booth.tableCluster.subTables.length,
    tableLengthFt: booth.tableCluster.tableLengthFt,
  }
}

export function patchBoothSubTableRotation(
  booth: BoothObject,
  subTableId: string,
  rotationOffsetDeg: number
): BoothObject {
  if (!booth.tableCluster) return booth
  const subTables = booth.tableCluster.subTables.map((sub) =>
    sub.id === subTableId
      ? { ...sub, rotationOffsetDeg: normalizeDeg(rotationOffsetDeg) }
      : sub
  )
  return syncBoothCompoundBounds({
    ...booth,
    tableCluster: { ...booth.tableCluster, subTables },
  })
}

export function applyTableClusterPreset(
  booth: BoothObject,
  presetId: TableClusterPresetId
): BoothObject {
  const pivot = clusterPivotWorld(booth)
  const next: BoothObject = {
    ...booth,
    tableCluster: createTableCluster(presetId),
    tableCount: tableCountForPreset(presetId),
    tableLengthFt: tableLengthFtForPreset(presetId),
  }
  const synced = syncBoothCompoundBounds(next)
  const newPivot = objectCenter(synced)
  return {
    ...synced,
    x: synced.x + (pivot.x - newPivot.x),
    y: synced.y + (pivot.y - newPivot.y),
  }
}

export function createBoothWithTableCluster(
  presetId: TableClusterPresetId,
  worldCenter: Point,
  options?: {
    rotation?: number
    categoryName?: string | null
    label?: string
  }
): BoothObject {
  const cluster = createTableCluster(presetId)
  const tableLengthFt = cluster.tableLengthFt
  const w = tableLengthFt
  const h = BOOTH_EQUIPMENT_DEPTH_FT
  const booth: BoothObject = {
    id: `obj-${crypto.randomUUID()}`,
    kind: 'booth',
    x: worldCenter.x - w / 2,
    y: worldCenter.y - h / 2,
    width: w,
    height: h,
    rotation: options?.rotation ?? 0,
    accentColor: null,
    categoryName: options?.categoryName ?? null,
    tableCluster: cluster,
    tableCount: cluster.subTables.length,
    tableLengthFt,
    label: options?.label,
  }
  return syncBoothCompoundBounds(booth)
}

/** Expand a booth to placement probes (single rect or one per sub-table). */
export function placementProbesForObject(obj: PlacedObject): PlacedObject[] {
  if (obj.kind === 'booth') {
    const booth = obj as BoothObject
    if (booth.tableCluster?.subTables.length) {
      return subTableWorldProbes(booth)
    }
  }
  return [obj]
}

export function boothHasTableCluster(
  booth: BoothObject
): booth is BoothObject & { tableCluster: BoothTableCluster } {
  return Boolean(booth.tableCluster?.subTables.length)
}

/** Union AABB for placement / clamp (compound when clustered). */
export function objectFootprintAabb(obj: PlacedObject): Rect {
  const probes = placementProbesForObject(obj)
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const probe of probes) {
    const aabb = rotatedAabb(probe)
    minX = Math.min(minX, aabb.x)
    minY = Math.min(minY, aabb.y)
    maxX = Math.max(maxX, aabb.x + aabb.width)
    maxY = Math.max(maxY, aabb.y + aabb.height)
  }
  if (!Number.isFinite(minX)) return rotatedAabb(obj)
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Merge a booth patch and refresh compound bounds / pivot when needed.
 */
/** Keep cluster pivot fixed when the whole unit is rotated. */
export function applyBoothObjectPatch(
  booth: BoothObject,
  patch: Partial<BoothObject>
): BoothObject {
  const merged = { ...booth, ...patch } as BoothObject
  if (!merged.tableCluster) return merged
  if (patch.rotation === undefined) return merged

  const pivotBefore = clusterPivotWorld(booth)
  const synced = syncBoothCompoundBounds(merged)
  const pivotAfter = objectCenter(synced)
  return {
    ...synced,
    x: synced.x + (pivotBefore.x - pivotAfter.x),
    y: synced.y + (pivotBefore.y - pivotAfter.y),
  }
}
