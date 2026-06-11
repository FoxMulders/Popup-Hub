import { boothPatchForTableSize } from '@/lib/booth-planner/table-booth-consolidation'
import type { TableSizeSpec } from '@/lib/booth-planner/table-shape'
import type { BoothObject, FloorPlanDoc, PlacedObject } from '../state/types'
import type { Rect } from './geometry'
import {
  findVendorBoothRowPeer,
  vendorBoothOrientationFromRowPeer,
  wallEdgeFromRotation,
} from '../engine/booth-layout-engine'
import {
  PLACEMENT_PREVIEW_WALL_SNAP_FT,
  orientVendorBoothToNearestWall,
  snapVendorBoothToPerimeter,
} from './vendor-booth-placement'
import {
  isStructuralWallSnapKind,
  resolveStructuralPlacementPreview,
} from './structural-wall-snap'

export type TablePlacementPreview = Rect & { rotation: number }

/** Resolve ghost rect + rotation after {@link resolveDrawCommitRect}. */
export function resolveTablePlacementPreview(
  kind: PlacedObject['kind'],
  rect: Rect,
  defaultBoothTableSpec: TableSizeSpec | undefined,
  doc: Pick<
    FloorPlanDoc,
    | 'rooms'
    | 'objectRoom'
    | 'objects'
    | 'canvasWidthFt'
    | 'canvasLengthFt'
    | 'gridSpacingFt'
    | 'snapFt'
  >,
  activeRoomId: string | null | undefined,
  snapToleranceFt = PLACEMENT_PREVIEW_WALL_SNAP_FT
): TablePlacementPreview | null {
  if (isStructuralWallSnapKind(kind)) {
    return resolveStructuralPlacementPreview(kind, rect, doc, activeRoomId)
  }
  if (kind !== 'booth') {
    return { ...rect, rotation: 0 }
  }

  const base = {
    id: '__preview__',
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: 0,
  }
  const sizePatch =
    defaultBoothTableSpec != null
      ? boothPatchForTableSize(base, defaultBoothTableSpec)
      : null
  let probe = {
    ...base,
    kind: 'booth' as const,
    accentColor: null,
    ...(sizePatch ?? {}),
  } as BoothObject

  if (defaultBoothTableSpec?.purpose === 'guest') {
    return {
      x: probe.x,
      y: probe.y,
      width: probe.width,
      height: probe.height,
      rotation: probe.rotation ?? 0,
    }
  }

  const previewRoomId = activeRoomId ?? doc.rooms?.[0]?.id ?? null
  const snapDoc =
    previewRoomId != null
      ? {
          ...doc,
          objectRoom: {
            ...(doc.objectRoom ?? {}),
            [probe.id]: previewRoomId,
          },
        }
      : doc

  const rowPeer = findVendorBoothRowPeer(probe, snapDoc.objects ?? [], {
    excludeId: probe.id,
    gridSpacingFt: snapDoc.gridSpacingFt,
  })
  if (rowPeer) {
    probe = { ...probe, ...vendorBoothOrientationFromRowPeer(probe, rowPeer) }
  }

  const preferredEdge = rowPeer
    ? wallEdgeFromRotation(rowPeer.rotation ?? 0)
    : undefined
  const snap = snapVendorBoothToPerimeter(
    probe,
    snapDoc,
    snapToleranceFt,
    preferredEdge
  )
  if (snap) {
    return {
      x: snap.x,
      y: snap.y,
      width: snap.width,
      height: snap.height,
      rotation: snap.rotation ?? 0,
    }
  }

  if (rowPeer) {
    return {
      x: probe.x,
      y: probe.y,
      width: probe.width,
      height: probe.height,
      rotation: probe.rotation ?? 0,
    }
  }

  const oriented = orientVendorBoothToNearestWall(probe, snapDoc)
  if (oriented) {
    return {
      x: oriented.x,
      y: oriented.y,
      width: oriented.width,
      height: oriented.height,
      rotation: oriented.rotation ?? 0,
    }
  }

  return {
    x: probe.x,
    y: probe.y,
    width: probe.width,
    height: probe.height,
    rotation: probe.rotation ?? 0,
  }
}
