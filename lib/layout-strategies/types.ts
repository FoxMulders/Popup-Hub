/** Canonical layout strategy types (spec-aligned). */

export interface Point {
  x: number
  y: number
}

export interface Room {
  boundary: Point[]
}

export interface Booth {
  id: string
  width: number
  height: number
}

export interface Entrance {
  x: number
  y: number
}

export interface Exit {
  x: number
  y: number
}

export interface LayoutRequest {
  room: Room
  booths: Booth[]
  entrance: Entrance
  exit: Exit
  /** Structural obstacles in room-local coordinates. */
  obstacles?: ReadonlyArray<{
    x: number
    y: number
    width: number
    height: number
    rotation?: number
  }>
  /** Room-local width when boundary is non-rectangular (ft). */
  roomWidthFt?: number
  /** Room-local height when boundary is non-rectangular (ft). */
  roomHeightFt?: number
  aisleFt?: number
  stepFt?: number
  eventCategoryNames?: ReadonlyArray<string>
}

export interface BoothPlacement {
  boothId: string
  x: number
  y: number
  rotation: number
  exposureScore: number
}

export interface FairnessDiagnostics {
  coveragePercentage: number
  exposureVariance: number
  lowestExposureBoothId: string | null
  highestExposureBoothId: string | null
  exposureHistogram: Array<{ bucket: string; count: number }>
  exposureHeatmap: Array<{ boothId: string; x: number; y: number; value: number }>
  missedBoothIds: string[]
  meets80PercentRule: boolean
  layoutValid: boolean
}

export interface FairnessReport {
  summary: string
  scoreFormula: string
  steps: Array<{ label: string; value: string | number; detail?: string }>
  diagnostics: FairnessDiagnostics
}

export interface LayoutResult {
  placements: BoothPlacement[]
  fairnessScore: number
  route: Point[]
  unplacedBoothIds?: string[]
  /** Present when generated as part of a multi-scenario fairness run. */
  scenarioId?: string
  scenarioLabel?: string
  /** Booths visited by PathfindingService tour / total placed (0–100). */
  coveragePercentage?: number
  exposureVariance?: number
  diagnostics?: FairnessDiagnostics
  report?: FairnessReport
  /** Grid cells for exposure heatmap overlay (room-local ft). */
  exposureHeatmap?: Array<{ x: number; y: number; size: number; value: number }>
  /** False when route coverage < 100% regardless of score. */
  layoutValid?: boolean
  rawFairnessScore?: number
  scoreCappedDueToRoute?: boolean
  scoreCapReason?: string
}

/** Serpentine / aisle seed variation for multi-scenario fairness runs. */
export type FairLayoutPrimaryAxis = 'vertical' | 'horizontal'

export type FairLayoutAisleSideBias =
  | 'both'
  | 'left'
  | 'right'
  | 'left-first'
  | 'right-first'

export interface FairLayoutScenarioOptions {
  scenarioId?: string
  scenarioLabel?: string
  primaryAxis?: FairLayoutPrimaryAxis
  reverseFlow?: boolean
  aisleSideBias?: FairLayoutAisleSideBias
  annealingSeed?: number
  annealingTimeBudgetMs?: number
  /** Skip traffic-aware fill — faster for alternate multi-scenario candidates. */
  skipTrafficSeed?: boolean
}

export interface FairLayoutCandidatesOptions {
  scenarioCount?: number
  /** Total wall-clock budget shared across scenarios (ms). */
  timeBudgetMs?: number
}
