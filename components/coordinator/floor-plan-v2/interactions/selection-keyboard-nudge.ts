'use client'

import { useEffect } from 'react'
import {
  footprintClampDeltaForRoom,
} from '@/lib/floor-plan/boundary-constraints'
import type { FloorPlanDocStore } from '../state/use-floor-plan-doc'
import type { BoothObject, PlacedObject } from '../state/types'
import { findFirstViolationInMove } from './category-rules'
import {
  canvasClampDelta,
  findOverlapInMove,
  groupCanvasClampDelta,
  rotatedAabb,
  aabbFitsCanvas,
} from './geometry'
import {
  isStructuralWallSnapKind,
  snapStructuralAssetForDoc,
  snapStructuralAssetToRoomFrame,
} from './structural-wall-snap'
import {
  isCardinalRotation,
  isVendorBoothObject,
  vendorBoothPerimeterSnapPatch,
  type RoomEdgeSide,
} from './vendor-booth-placement'

export const KEYBOARD_NUDGE_STEP_FT = 1
export const KEYBOARD_NUDGE_SHIFT_STEP_FT = 5

export type KeyboardNudgeDirection = 'up' | 'down' | 'left' | 'right'

function deltaForDirection(
  direction: KeyboardNudgeDirection,
  stepFt: number
): { dx: number; dy: number } {
  switch (direction) {
    case 'up':
      return { dx: 0, dy: -stepFt }
    case 'down':
      return { dx: 0, dy: stepFt }
    case 'left':
      return { dx: -stepFt, dy: 0 }
    case 'right':
      return { dx: stepFt, dy: 0 }
  }
}

function directionFromArrowKey(key: string): KeyboardNudgeDirection | null {
  switch (key) {
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    default:
      return null
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}

function applyVendorSnap(
  booth: BoothObject,
  doc: FloorPlanDocStore['doc'],
  preferredEdge?: RoomEdgeSide | null
): BoothObject {
  const snap = vendorBoothPerimeterSnapPatch(booth, doc, {
    preferredEdge,
    positionOnly: true,
  })
  if (!snap) return booth
  if (!isCardinalRotation(booth.rotation ?? 0)) {
    const { rotation: _ignored, ...positionPatch } = snap
    return { ...booth, ...positionPatch } as BoothObject
  }
  return { ...booth, ...snap } as BoothObject
}

function objectWithPatch(
  obj: PlacedObject,
  patch: Partial<PlacedObject>
): PlacedObject {
  return { ...obj, ...patch } as PlacedObject
}

function patchAfterNudge(
  obj: PlacedObject,
  dx: number,
  dy: number,
  doc: FloorPlanDocStore['doc'],
  activeRoomId: string | null | undefined,
  preferredEdge?: RoomEdgeSide | null
): Partial<PlacedObject> {
  let patch: Partial<PlacedObject> = {
    x: obj.x + dx,
    y: obj.y + dy,
  }
  if (isVendorBoothObject(obj)) {
    const snapped = applyVendorSnap(
      objectWithPatch(obj, patch) as BoothObject,
      doc,
      preferredEdge
    )
    patch = {
      x: snapped.x,
      y: snapped.y,
      width: snapped.width,
      height: snapped.height,
      rotation: snapped.rotation,
    }
  } else if (isStructuralWallSnapKind(obj.kind)) {
    const structuralRoomId = doc.objectRoom?.[obj.id] ?? activeRoomId
    const frame = structuralRoomId
      ? doc.rooms?.find((r) => r.id === structuralRoomId)
      : null
    if (frame) {
      patch = snapStructuralAssetToRoomFrame(objectWithPatch(obj, patch), frame)
    } else {
      const snap = snapStructuralAssetForDoc(objectWithPatch(obj, patch), doc)
      if (snap) patch = snap
    }
  }

  const roomId = doc.objectRoom?.[obj.id] ?? activeRoomId ?? null
  const roomClampDelta = footprintClampDeltaForRoom(
    objectWithPatch(obj, patch),
    doc,
    roomId
  )
  patch = {
    ...patch,
    x: (patch.x ?? obj.x) + roomClampDelta.dx,
    y: (patch.y ?? obj.y) + roomClampDelta.dy,
  }

  const probe = objectWithPatch(obj, patch)
  const cw = doc.canvasWidthFt
  const cl = doc.canvasLengthFt
  const canvasClamp = canvasClampDelta(probe, cw, cl)
  return {
    ...patch,
    x: (patch.x ?? obj.x) + canvasClamp.dx,
    y: (patch.y ?? obj.y) + canvasClamp.dy,
  }
}

function clampGroupToCanvas(
  entries: Array<{ id: string; patch: Partial<PlacedObject>; probe: PlacedObject }>,
  cw: number,
  cl: number
): Array<{ id: string; patch: Partial<PlacedObject> }> | null {
  const probes = entries.map((e) => e.probe)
  const unionDelta = groupCanvasClampDelta(probes, cw, cl)
  if (unionDelta) {
    return entries.map((e) => ({
      id: e.id,
      patch: {
        ...e.patch,
        x: e.probe.x + unionDelta.dx,
        y: e.probe.y + unionDelta.dy,
      },
    }))
  }
  return entries.map((e) => {
    const { dx, dy } = canvasClampDelta(e.probe, cw, cl)
    return {
      id: e.id,
      patch: {
        ...e.patch,
        x: e.probe.x + dx,
        y: e.probe.y + dy,
      },
    }
  })
}

export interface SelectionKeyboardNudgeOptions {
  activeRoomId?: string | null
  onProximityViolation?: (info: {
    category: string
    dxColumns: number
    dyRows: number
  }) => void
  onOverlapViolation?: () => void
}

/**
 * Move every unlocked selected object by `stepFt` along one axis. Applies the
 * same clamp, wall snap, proximity, and overlap gates as pointer drag commit.
 */
export function nudgeSelectedObjects(
  store: FloorPlanDocStore,
  direction: KeyboardNudgeDirection,
  stepFt: number,
  options?: SelectionKeyboardNudgeOptions
): boolean {
  const ids = Array.from(store.selectedIds)
  if (ids.length === 0) return false

  const { dx, dy } = deltaForDirection(direction, stepFt)
  const doc = store.doc
  const activeRoomId = options?.activeRoomId ?? null
  const objById = new Map(doc.objects.map((o) => [o.id, o]))
  const moveIds = ids.filter((id) => {
    const obj = objById.get(id)
    return obj && !obj.locked
  })
  if (moveIds.length === 0) return false

  type Entry = {
    id: string
    patch: Partial<PlacedObject>
    probe: PlacedObject
  }
  const entries: Entry[] = []
  for (const id of moveIds) {
    const obj = objById.get(id)
    if (!obj) continue
    const patch = patchAfterNudge(obj, dx, dy, doc, activeRoomId)
    if (patch.x === obj.x && patch.y === obj.y) continue
    entries.push({
      id,
      patch,
      probe: objectWithPatch(obj, patch),
    })
  }
  if (entries.length === 0) return false

  const cw = doc.canvasWidthFt
  const cl = doc.canvasLengthFt
  const clamped = clampGroupToCanvas(entries, cw, cl)
  if (!clamped) return false

  for (const entry of clamped) {
    const probe = objectWithPatch(
      objById.get(entry.id)!,
      entry.patch
    )
    const aabb = rotatedAabb(probe)
    if (!aabbFitsCanvas(aabb, cw, cl)) return false
  }

  const movedResolved = clamped.map((entry) =>
    objectWithPatch(objById.get(entry.id)!, entry.patch)
  )
  const movedIdSet = new Set(moveIds)
  const movedBooths: BoothObject[] = []
  for (const obj of movedResolved) {
    if (obj.kind === 'booth') movedBooths.push(obj as BoothObject)
  }
  const others = doc.objects.filter((o) => !movedIdSet.has(o.id))
  const gridSpacingFt = doc.gridSpacingFt || 1
  const violation = findFirstViolationInMove(
    movedBooths,
    others,
    gridSpacingFt
  )
  if (violation) {
    options?.onProximityViolation?.({
      category: violation.category,
      dxColumns: violation.dxColumns,
      dyRows: violation.dyRows,
    })
    return false
  }
  if (
    findOverlapInMove(movedResolved, others, {
      rooms: doc.rooms ?? [],
      objectRoom: doc.objectRoom,
      doc,
    })
  ) {
    options?.onOverlapViolation?.()
    return false
  }

  store.updateObjects(clamped, { pushHistory: true })
  return true
}

export function useSelectionKeyboardNudge(
  store: FloorPlanDocStore,
  options?: SelectionKeyboardNudgeOptions
): void {
  const activeRoomId = options?.activeRoomId ?? null
  const onProximityViolation = options?.onProximityViolation
  const onOverlapViolation = options?.onOverlapViolation

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isEditableTarget(e.target)) return

      const direction = directionFromArrowKey(e.key)
      if (!direction) return
      if (store.selectedIds.size === 0) return

      const stepFt = e.shiftKey
        ? KEYBOARD_NUDGE_SHIFT_STEP_FT
        : KEYBOARD_NUDGE_STEP_FT
      const moved = nudgeSelectedObjects(store, direction, stepFt, {
        activeRoomId,
        onProximityViolation,
        onOverlapViolation,
      })
      if (moved) e.preventDefault()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    activeRoomId,
    onOverlapViolation,
    onProximityViolation,
    store,
  ])
}
