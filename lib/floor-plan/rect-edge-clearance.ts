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
