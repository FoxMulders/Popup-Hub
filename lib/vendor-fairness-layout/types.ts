/** Canonical types for the Vendor Fairness Layout Engine. */

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
}

export interface BoothPlacement {
  boothId: string
  x: number
  y: number
  rotation: number
  exposureScore: number
}

export interface LayoutResult {
  placements: BoothPlacement[]
  fairnessScore: number
  route: Point[]
}

/** Internal geometry types. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface RotatedBooth {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface AisleSkeleton {
  /** Centerline polyline for serpentine circulation. */
  centerline: Point[]
  /** Walkable corridor width (ft). */
  widthFt: number
}

export interface ExposureMetrics {
  boothId: string
  impressions: number
  passBys: number
  visitLikelihood: number
  /** Composite 0–1 exposure score. */
  score: number
}

export interface FairnessBreakdown {
  fairnessScore: number
  exposureVariance: number
  normalizedVariance: number
  boothScores: Map<string, number>
  heatmap: Array<{ x: number; y: number; value: number }>
}

export interface GenerateOptions {
  /** Max wall inset from room boundary (ft). Default 3.5. */
  wallInsetFt?: number
  /** Minimum edge-to-edge aisle between booths (ft). Default 3. */
  aisleFt?: number
  /** Patron corridor width (ft). Default 7. */
  corridorWidthFt?: number
  /** Virtual attendee count for exposure sim. Default 1000. */
  attendeeCount?: number
  /** Optimizer time budget (ms). Default 1800. */
  timeBudgetMs?: number
  /** Grid resolution for pathfinding (ft). Default 2. */
  cellFt?: number
}
