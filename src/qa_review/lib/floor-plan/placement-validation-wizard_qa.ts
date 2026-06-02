/**
 * Wizard Step 3 placement — open canvas when no room frames exist yet.
 */

import { activeDropZoneRooms, findRoomIdForPlacementPoint } from '@/components/coordinator/floor-plan-v2/geometry/is-point-in-room'
import { isValidPlacementLocationBBox } from '@/components/coordinator/floor-plan-v2/state/geometry-sanitize'
import type { FloorPlanDoc, PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'

export function isWizardOpenCanvas(doc: FloorPlanDoc): boolean {
  return activeDropZoneRooms(doc).length === 0
}

function probeCenter(
  probeFt: { x: number; y: number },
  obj?: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>
): { x: number; y: number } {
  if (obj != null) {
    return { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 }
  }
  return probeFt
}

function objectFitsOpenCanvas(
  doc: FloorPlanDoc,
  obj: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height'>
): boolean {
  const pad = 0
  const maxX = doc.canvasWidthFt ?? 50
  const maxY = doc.canvasLengthFt ?? 50
  return (
    obj.x >= pad &&
    obj.y >= pad &&
    obj.x + obj.width <= maxX - pad &&
    obj.y + obj.height <= maxY - pad
  )
}

export function isValidPlacementLocationWizardQa(
  doc: FloorPlanDoc,
  probeFt: { x: number; y: number },
  obj?: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>
): boolean {
  if (isWizardOpenCanvas(doc)) {
    if (obj != null) return objectFitsOpenCanvas(doc, obj)
    const p = probeCenter(probeFt, obj)
    return (
      p.x >= 0 &&
      p.y >= 0 &&
      p.x <= (doc.canvasWidthFt ?? 50) &&
      p.y <= (doc.canvasLengthFt ?? 50)
    )
  }
  return isValidPlacementLocationBBox(doc, probeFt, obj)
}

export function findRoomIdForPlacementPointWizardQa(
  doc: FloorPlanDoc,
  p: { x: number; y: number }
): string | null {
  const roomId = findRoomIdForPlacementPoint(doc, p)
  if (roomId) return roomId
  if (!isWizardOpenCanvas(doc)) return null
  const maxX = doc.canvasWidthFt ?? 50
  const maxY = doc.canvasLengthFt ?? 50
  if (p.x >= 0 && p.y >= 0 && p.x <= maxX && p.y <= maxY) return null
  return null
}

export function allowsWizardPlacementWithoutRoom(doc: FloorPlanDoc): boolean {
  return isWizardOpenCanvas(doc)
}
