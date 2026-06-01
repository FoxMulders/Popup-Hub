/**
 * Initial doc hydration — server layout vs localStorage crash-recovery draft.
 */

import { docFromLegacyRooms } from './legacy-bridge'
import { clearMultiRoomDraft, loadMultiRoomDraft } from './local-draft'
import { forceRecomputeGeometry } from './geometry-sanitize'
import { reconcileCanvasExtents } from './room-canvas'
import type { FloorPlanDoc } from './types'
import type { LayoutRoom } from '@/types/database'

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
  const seeded = reconcileDocExtents(
    stripMergedZoneOverlays(
      forceRecomputeGeometry(docFromLegacyRooms(layoutRooms))
    )
  )

  if (!eventId) return seeded

  if (options.preferServerLayout) {
    clearMultiRoomDraft(eventId)
    return seeded
  }

  const cached = loadMultiRoomDraft(eventId)
  if (!cached?.doc) return seeded

  return reconcileDocExtents(
    stripMergedZoneOverlays(forceRecomputeGeometry(cached.doc))
  )
}
