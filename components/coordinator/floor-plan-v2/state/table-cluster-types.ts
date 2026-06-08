/**
 * Table cluster types only — no geometry imports (avoids circular deps with types.ts).
 */

import type { LayoutBaselineTableLengthFt } from '@/lib/booth-planner/layout-table-size'

export type TableClusterPresetId = '2x5' | '2x6' | '3x5' | '3x6'

export interface BoothSubTable {
  id: string
  /** Center offset from cluster pivot (ft), cluster-local frame. */
  localCenterX: number
  localCenterY: number
  tableLengthFt: number
  /** Degrees clockwise relative to cluster `rotation`. */
  rotationOffsetDeg: number
}

/** `spaced` = legacy consolidation gap; `contiguous` = end-to-end modular baseline. */
export type TableClusterLayoutMode = 'spaced' | 'contiguous'

export interface BoothTableCluster {
  presetId: TableClusterPresetId
  /** Per-module table length (ft). Parent booth width = sum of modules. */
  tableLengthFt: LayoutBaselineTableLengthFt
  subTables: BoothSubTable[]
  layout?: TableClusterLayoutMode
}
