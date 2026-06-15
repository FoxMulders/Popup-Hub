/**
 * Initial doc hydration — server layout vs localStorage crash-recovery draft.
 *
 * Only booth `cells` count as saved geometry. Metadata-only rows (room frames,
 * entrance/exit fixtures in `venue_elements`) open on a blank grid.
 */

import { docFromLegacyRooms, frameListFromRooms } from './legacy-bridge'
import { clearMultiRoomDraft, loadMultiRoomDraft } from './local-draft'
import { forceRecomputeGeometry } from './geometry-sanitize'
import { ensureDefaultTrafficDoors } from './ensure-default-traffic-doors'
import { reconcileCanvasExtents } from './room-canvas'
import { makeEmptyDoc } from './types'
import type { FloorPlanDoc } from './types'
import type { LayoutRoom } from '@/types/database'

function layoutRoomsHaveSavedBooths(rooms: ReadonlyArray<LayoutRoom>): boolean {
  return rooms.some((r) => (r.cells?.length ?? 0) > 0)
}

function reconcileDocExtents(doc: FloorPlanDoc): FloorPlanDoc {
  const frames = doc.rooms ?? []
  if (frames.length === 0) return doc
  const extents = reconcileCanvasExtents(frames)
  return {
    ...doc,
    canvasWidthFt: Math.max(extents.canvasWidthFt, doc.canvasWidthFt, 50),
    canvasLengthFt: Math.max(extents.canvasLengthFt, doc.canvasLengthFt, 50),
  }
}

/** Remove decorative merge overlays — placement uses `doc.rooms` only. */
export function stripMergedZoneOverlays(doc: FloorPlanDoc): FloorPlanDoc {
  if (!doc.objects.some((o) => o.kind === 'merged_zone')) return doc
  return forceRecomputeGeometry({
    ...doc,
    objects: doc.objects.filter((o) => o.kind !== 'merged_zone'),
  })
}

function blankEditorDoc(): FloorPlanDoc {
  return forceRecomputeGeometry({
    ...makeEmptyDoc(50, 50),
    rooms: [],
    objects: [],
    objectRoom: {},
  })
}

function docFromSavedLayout(layoutRooms: LayoutRoom[]): FloorPlanDoc {
  return stripMergedZoneOverlays(
    forceRecomputeGeometry(docFromLegacyRooms(layoutRooms))
  )
}

export interface HydrateFloorPlanDocOptions {
  /**
   * Standalone layout editor — load Supabase/project rooms only.
   * Clears the multi-room localStorage draft so stale geometry cannot win.
   */
  preferServerLayout?: boolean
}

export function hydrateFloorPlanDoc(
  eventId: string | null | undefined,
  layoutRooms: LayoutRoom[],
  options: HydrateFloorPlanDocOptions = {}
): FloorPlanDoc {
  const { preferServerLayout = false } = options
  const shouldHydrate = layoutRoomsHaveSavedBooths(layoutRooms)

  if (eventId && (preferServerLayout || !shouldHydrate)) {
    clearMultiRoomDraft(eventId)
  }

  if (shouldHydrate && layoutRooms.length > 0) {
    return reconcileDocExtents(docFromSavedLayout(layoutRooms))
  }

  if (eventId && !preferServerLayout && !shouldHydrate && layoutRooms.length > 0) {
    const cached = loadMultiRoomDraft(eventId)
    const cachedObjects = cached?.doc?.objects?.length ?? 0
    const cachedRooms = cached?.doc?.rooms?.length ?? 0
    if (cached?.doc && (cachedObjects > 0 || cachedRooms > 0)) {
      return reconcileDocExtents(
        stripMergedZoneOverlays(forceRecomputeGeometry(cached.doc))
      )
    }
    clearMultiRoomDraft(eventId)
  }

  if (layoutRooms.length > 0) {
    const frames = frameListFromRooms(layoutRooms)
    return reconcileDocExtents(
      ensureDefaultTrafficDoors(
        forceRecomputeGeometry({
          ...makeEmptyDoc(50, 50),
          rooms: frames,
          objects: [],
          objectRoom: {},
        })
      )
    )
  }

  return blankEditorDoc()
}
