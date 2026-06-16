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

export type LayoutOutcomeReason =
  | 'complete'
  | 'physical_capacity_exceeded'
  | 'routing_failure'
  | 'optimization_failure'
  | 'algorithm_limitation'

export interface LayoutCapacityReport {
  originalBoothCount: number
  maximumFairCapacity: number
  removedBoothIds: string[]
  removalReason: LayoutOutcomeReason | null
  /** True when vendors were removed after a capacity proof — never equivalent to full roster. */
  isPartialLayout: boolean
}

export interface LayoutScores {
  /** 100 when every requested vendor is placed; lower when capacity-limited subset. */
  capacityScore: number
  /** PathfindingService tour coverage on the placed set (0–100). */
  coverageScore: number
  /** Exposure balance on placed set; 0 when coverageScore < 100. */
  fairnessScore: number
}

export interface FairnessDiagnostics {
  coveragePercentage: number
  capacityScore: number
  coverageScore: number
  exposureVariance: number
  lowestExposureBoothId: string | null
  highestExposureBoothId: string | null
  exposureHistogram: Array<{ bucket: string; count: number }>
  exposureHeatmap: Array<{ boothId: string; x: number; y: number; value: number }>
  missedBoothIds: string[]
  meets80PercentRule: boolean
  layoutValid: boolean
  outcomeReason?: LayoutOutcomeReason
  capacityReport?: LayoutCapacityReport
}

export interface FairnessReport {
  summary: string
  scoreFormula: string
  steps: Array<{ label: string; value: string | number; detail?: string }>
  diagnostics: FairnessDiagnostics
}

export interface LayoutResult {
  placements: BoothPlacement[]
  /** Exposure fairness score (alias of scores.fairnessScore). */
  fairnessScore: number
  route: Point[]
  unplacedBoothIds?: string[]
  /** Present when generated as part of a multi-scenario fairness run. */
  scenarioId?: string
  scenarioLabel?: string
  /** Booths visited by PathfindingService tour / total placed (0–100). Alias of scores.coverageScore. */
  coveragePercentage?: number
  exposureVariance?: number
  diagnostics?: FairnessDiagnostics
  report?: FairnessReport
  /** Grid cells for exposure heatmap overlay (room-local ft). */
  exposureHeatmap?: Array<{ x: number; y: number; size: number; value: number }>
  /** False when route coverage < 100% or partial capacity layout. */
  layoutValid?: boolean
  rawFairnessScore?: number
  scoreCappedDueToRoute?: boolean
  scoreCapReason?: string
  scores?: LayoutScores
  outcomeReason?: LayoutOutcomeReason
  capacityReport?: LayoutCapacityReport
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
