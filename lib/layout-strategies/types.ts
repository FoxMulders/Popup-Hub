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

export interface LayoutResult {
  placements: BoothPlacement[]
  fairnessScore: number
  route: Point[]
  unplacedBoothIds?: string[]
}
