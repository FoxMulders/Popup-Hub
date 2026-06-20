/** Axis-aligned rectangle in floor-plan feet space. */
export interface AxisAlignedRect {
  x: number
  y: number
  width: number
  height: number
}

/** Minimum positive edge-to-edge gap between two axis-aligned rects (ft). */
export function edgeClearanceBetweenRects(a: AxisAlignedRect, b: AxisAlignedRect): number {
  const overlapX =
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (overlapX > 0 && overlapY > 0) return 0

  const gapX = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0)
  const gapY = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0)

  if (gapX > 0 && gapY > 0) return Math.min(gapX, gapY)
  if (gapX > 0) return gapX
  if (gapY > 0) return gapY
  return 0
}

function normalizeRotationDeg(rotation: number): number {
  return ((rotation % 360) + 360) % 360
}

/** True when two cardinal booth facings run along different aisle axes. */
export function vendorBoothOrientationsPerpendicular(
  rotationA: number,
  rotationB: number
): boolean {
  const a = normalizeRotationDeg(rotationA) % 180
  const b = normalizeRotationDeg(rotationB) % 180
  const diff = Math.abs(a - b)
  return diff > 0.5 && diff < 179.5
}

/**
 * Aisle clearance between two vendor booths — only parallel neighbors
 * (shared row or column). Diagonal pairs and perpendicular perimeter
 * booths are ignored so a corner column does not tint the opposite row
 * red/yellow.
 */
export function vendorBoothAisleClearanceFt(
  a: AxisAlignedRect,
  b: AxisAlignedRect,
  options?: { rotationA?: number; rotationB?: number }
): number {
  const overlapX =
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (overlapX > 0 && overlapY > 0) return 0

  const rotA = options?.rotationA ?? 0
  const rotB = options?.rotationB ?? 0
  if (vendorBoothOrientationsPerpendicular(rotA, rotB)) {
    return Number.POSITIVE_INFINITY
  }

  const gapX = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0)
  const gapY = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0)

  if (overlapY > 0) return gapX
  if (overlapX > 0) return gapY
  return Number.POSITIVE_INFINITY
}
