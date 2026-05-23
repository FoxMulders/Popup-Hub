/**
 * 100-scenario memory-optimized layout regression — run: npm run qa:regression
 */
import { autoLayout } from '@/lib/booth-planner/algorithm'
import { buildEntranceExitOnlyElements } from '@/lib/booth-planner/co-generated-aisles'
import { SpatialBitGrid, CELL_BOOTH } from '@/lib/booth-planner/spatial-bitmap'
import { QuadrantMemoryGrid, shouldPartitionGrid } from '@/lib/booth-planner/quadrant-grid'
import { gridSpansForTableLength } from '@/lib/booth-planner/layout-table-size'

const TABLE_LENGTHS = [5, 6, 8, 10] as const
const ENTRANCES = ['north', 'south', 'east', 'west'] as const
const CATEGORY_POOL = [
  { name: 'Makers', color: '#2D5A27', weight: 50 },
  { name: 'Art', color: '#6B4E71', weight: 15 },
  { name: 'Food', color: '#C17F24', weight: 15 },
  { name: 'Apparel', color: '#1F4E79', weight: 10 },
  { name: 'Commercial', color: '#8B4513', weight: 10 },
] as const

export interface RegressionLogEntry {
  level: 'info' | 'error'
  message: string
  telemetry?: Record<string, unknown>
}

export interface RegressionRunResult {
  passed: number
  total: number
  completed: number
  failed: string[]
  logs: RegressionLogEntry[]
  /** True when execution was halted before completing all scenarios. */
  stopped?: boolean
}

export type RegressionProgress = RegressionRunResult

export interface RegressionRunOptions {
  signal?: AbortSignal
  /** Immediate cancel gate — flipped by Stop QA before AbortSignal propagates. */
  isCancelled?: () => boolean
}

function collectOverlapCells(
  cells: ReturnType<typeof autoLayout>['cells'],
  bitmap: SpatialBitGrid | QuadrantMemoryGrid
): string[] {
  const overlapCells: string[] = []
  for (let ci = 0; ci < cells.length; ci++) {
    const cell = cells[ci]
    if (cell.col < 0) continue
    if (!bitmap.canPlaceRect(cell.col, cell.row, cell.colSpan, cell.rowSpan)) {
      for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
        for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
          overlapCells.push(`${c},${r}`)
        }
      }
      break
    }
    bitmap.fillRect(cell.col, cell.row, cell.colSpan, cell.rowSpan, CELL_BOOTH, false)
  }
  return overlapCells
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeightedCategory(rng: () => number, skew: number): { name: string; color: string } {
  const pool = CATEGORY_POOL.map((c) => ({
    name: c.name,
    color: c.color,
    weight: c.weight ** skew,
  }))
  const total = pool.reduce((s, c) => s + c.weight, 0)
  let roll = rng() * total
  for (const c of pool) {
    roll -= c.weight
    if (roll <= 0) return c
  }
  return pool[pool.length - 1]
}

function scenarioVendorCount(width: number, length: number, tableFt: number): number {
  const { colSpan, rowSpan } = gridSpansForTableLength(tableFt, 'one_foot')
  const cols = Math.floor(width)
  const rows = Math.floor(length)
  const unitCells = colSpan * (rowSpan + 8)
  const reserve = Math.floor(cols * rows * 0.48)
  return Math.max(3, Math.min(18, Math.floor((cols * rows - reserve) / unitCells)))
}

export function runLayoutRegression100(
  seed = 42,
  onProgress?: (progress: RegressionProgress) => void
): RegressionRunResult {
  const rng = mulberry32(seed)
  const failed: string[] = []
  const logs: RegressionLogEntry[] = []
  const total = 100

  for (let i = 0; i < total; i++) {
    const width = 24 + Math.floor(rng() * 48)
    const length = 24 + Math.floor(rng() * 48)
    const tableFt = TABLE_LENGTHS[Math.floor(rng() * TABLE_LENGTHS.length)]
    const entrance = ENTRANCES[Math.floor(rng() * ENTRANCES.length)]
    const skew = 0.6 + rng() * 1.8
    const vendorCount = scenarioVendorCount(width, length, tableFt)
    const { colSpan, rowSpan } = gridSpansForTableLength(tableFt, 'one_foot')

    const cols = Math.floor(width)
    const rows = Math.floor(length)
    const shell = buildEntranceExitOnlyElements(entrance, cols, rows)
    const partitioned = shouldPartitionGrid(cols, rows)

    const vendors = Array.from({ length: vendorCount }, (_, vi) => {
      const cat = pickWeightedCategory(rng, skew)
      return {
        id: `s${i}-v${vi}`,
        vendorName: `Vendor ${vi + 1}`,
        categoryName: cat.name,
        categoryId: `${cat.name}-${vi % 3}`,
        categoryColor: cat.color,
        colSpan,
        rowSpan,
        tableLengthFt: tableFt,
      }
    })

    const result = autoLayout({
      venueWidth: width,
      venueLength: length,
      boothWidth: 1,
      boothLength: 1,
      entrance,
      venueElements: shell,
      vendors,
      fcfsOrder: true,
      coGenerateAisles: true,
    })

    const bitmap = partitioned
      ? QuadrantMemoryGrid.fromLayout(cols, rows, result.venueElements, [])
      : new SpatialBitGrid(cols, rows)
    if (!partitioned) {
      ;(bitmap as SpatialBitGrid).markVenueElements(result.venueElements)
    }

    const overlapCells = collectOverlapCells(result.cells, bitmap)
    const overlap = overlapCells.length > 0

    if (overlap) {
      const msg = `#${i + 1} ${width}×${length} table=${tableFt}ft overlap placed=${result.placedCount}/${vendorCount}`
      failed.push(msg)
      logs.push({
        level: 'error',
        message: msg,
        telemetry: {
          scenario: i + 1,
          width,
          length,
          cols,
          rows,
          partitioned,
          entrance,
          tableFt,
          overlapAt: overlapCells,
          placed: result.placedCount,
          requested: vendorCount,
        },
      })
    }

    onProgress?.({
      passed: i + 1 - failed.length,
      total,
      completed: i + 1,
      failed: [...failed],
      logs: [...logs],
    })
  }

  return { passed: total - failed.length, total, completed: total, failed, logs }
}

/** Browser-friendly runner — yields between scenarios to keep UI responsive. */
export async function runLayoutRegression100Async(
  seed = 42,
  onProgress?: (progress: RegressionProgress) => void,
  options?: RegressionRunOptions
): Promise<RegressionRunResult> {
  const rng = mulberry32(seed)
  const failed: string[] = []
  const logs: RegressionLogEntry[] = []
  const total = 100
  const signal = options?.signal
  const isCancelled = options?.isCancelled

  for (let i = 0; i < total; i++) {
    if (signal?.aborted || isCancelled?.()) {
      const completed = i
      const snapshot: RegressionRunResult = {
        passed: completed - failed.length,
        total,
        completed,
        failed: [...failed],
        logs: [...logs],
        stopped: true,
      }
      onProgress?.(snapshot)
      return snapshot
    }

    const width = 24 + Math.floor(rng() * 48)
    const length = 24 + Math.floor(rng() * 48)
    const tableFt = TABLE_LENGTHS[Math.floor(rng() * TABLE_LENGTHS.length)]
    const entrance = ENTRANCES[Math.floor(rng() * ENTRANCES.length)]
    const skew = 0.6 + rng() * 1.8
    const vendorCount = scenarioVendorCount(width, length, tableFt)
    const { colSpan, rowSpan } = gridSpansForTableLength(tableFt, 'one_foot')

    const cols = Math.floor(width)
    const rows = Math.floor(length)
    const shell = buildEntranceExitOnlyElements(entrance, cols, rows)
    const partitioned = shouldPartitionGrid(cols, rows)

    const vendors = Array.from({ length: vendorCount }, (_, vi) => {
      const cat = pickWeightedCategory(rng, skew)
      return {
        id: `s${i}-v${vi}`,
        vendorName: `Vendor ${vi + 1}`,
        categoryName: cat.name,
        categoryId: `${cat.name}-${vi % 3}`,
        categoryColor: cat.color,
        colSpan,
        rowSpan,
        tableLengthFt: tableFt,
      }
    })

    const result = autoLayout({
      venueWidth: width,
      venueLength: length,
      boothWidth: 1,
      boothLength: 1,
      entrance,
      venueElements: shell,
      vendors,
      fcfsOrder: true,
      coGenerateAisles: true,
    })

    const bitmap = partitioned
      ? QuadrantMemoryGrid.fromLayout(cols, rows, result.venueElements, [])
      : new SpatialBitGrid(cols, rows)
    if (!partitioned) {
      ;(bitmap as SpatialBitGrid).markVenueElements(result.venueElements)
    }

    const overlapCells = collectOverlapCells(result.cells, bitmap)
    const overlap = overlapCells.length > 0

    if (signal?.aborted || isCancelled?.()) {
      const completed = i
      const snapshot: RegressionRunResult = {
        passed: completed - failed.length,
        total,
        completed,
        failed: [...failed],
        logs: [...logs],
        stopped: true,
      }
      onProgress?.(snapshot)
      return snapshot
    }

    if (overlap) {
      const msg = `#${i + 1} ${width}×${length} table=${tableFt}ft overlap placed=${result.placedCount}/${vendorCount}`
      failed.push(msg)
      logs.push({
        level: 'error',
        message: msg,
        telemetry: {
          scenario: i + 1,
          width,
          length,
          cols,
          rows,
          partitioned,
          entrance,
          tableFt,
          overlapAt: overlapCells,
          placed: result.placedCount,
          requested: vendorCount,
        },
      })
    }

    onProgress?.({
      passed: i + 1 - failed.length,
      total,
      completed: i + 1,
      failed: [...failed],
      logs: [...logs],
      stopped: false,
    })

    if (signal?.aborted || isCancelled?.()) {
      const completed = i + 1
      const snapshot: RegressionRunResult = {
        passed: completed - failed.length,
        total,
        completed,
        failed: [...failed],
        logs: [...logs],
        stopped: true,
      }
      onProgress?.(snapshot)
      return snapshot
    }

    if (i % 4 === 3) {
      await new Promise((r) => setTimeout(r, 0))
      if (signal?.aborted || isCancelled?.()) {
        const completed = i + 1
        const snapshot: RegressionRunResult = {
          passed: completed - failed.length,
          total,
          completed,
          failed: [...failed],
          logs: [...logs],
          stopped: true,
        }
        onProgress?.(snapshot)
        return snapshot
      }
    }
  }

  return { passed: total - failed.length, total, completed: total, failed, logs, stopped: false }
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('qa-regression-100')) {
  const { passed, failed } = runLayoutRegression100()
  if (failed.length > 0) {
    console.error(`✗ ${failed.length} scenario(s) failed:`)
    for (const line of failed.slice(0, 10)) console.error('  ', line)
    if (failed.length > 10) console.error(`  … and ${failed.length - 10} more`)
    process.exit(1)
  }
  console.log(`✓ 100-scenario layout regression passed (${passed}/100)`)
}
