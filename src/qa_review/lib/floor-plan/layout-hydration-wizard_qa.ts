/**
 * Wizard Step 3 hydration — blank interactive canvas on load.
 * Ignores stale localStorage multi-room drafts; strips decorative objects.
 */

import { frameListFromRooms } from '@/components/coordinator/floor-plan-v2/state/legacy-bridge'
import { stripMergedZoneOverlays } from '@/components/coordinator/floor-plan-v2/state/layout-hydration'
import { clearMultiRoomDraft } from '@/components/coordinator/floor-plan-v2/state/local-draft'
import { forceRecomputeGeometry } from '@/components/coordinator/floor-plan-v2/state/geometry-sanitize'
import { reconcileCanvasExtents } from '@/components/coordinator/floor-plan-v2/state/room-canvas'
import { makeEmptyDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import type { FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import type { BoothLayout, LayoutRoom } from '@/types/database'
import { docFromLegacyRooms } from '@/components/coordinator/floor-plan-v2/state/legacy-bridge'

export interface HydrateWizardFloorPlanDocOptions {
  /** When set, room frames come from saved server layout but objects still clear on wizard entry. */
  existingLayout?: BoothLayout | null
  /** Load saved booth/venue objects from server layout (edit existing market). */
  hydrateSavedObjects?: boolean
}

function docWithRoomFramesOnly(rooms: ReadonlyArray<LayoutRoom>): FloorPlanDoc {
  if (rooms.length === 0) {
    return forceRecomputeGeometry({
      ...makeEmptyDoc(50, 50),
      rooms: [],
      objects: [],
      objectRoom: {},
    })
  }

  const frames = frameListFromRooms(rooms)
  const extents = reconcileCanvasExtents(frames)
  return forceRecomputeGeometry(
    stripMergedZoneOverlays({
      canvasWidthFt: Math.max(extents.canvasWidthFt, 50),
      canvasLengthFt: Math.max(extents.canvasLengthFt, 50),
      gridSpacingFt: 1,
      snapFt: 1,
      rooms: frames,
      objects: [],
      objectRoom: {},
    })
  )
}

/**
 * Wizard floor plan initial doc:
 * - Clears multi-room localStorage draft (prevents frozen stale geometry).
 * - Default: room frames from Step 1/2 `layoutRooms`, zero placed objects.
 * - Optional: full server layout when editing an existing saved market.
 */
export function hydrateFloorPlanDocForWizardQa(
  eventId: string | null | undefined,
  layoutRooms: LayoutRoom[],
  options: HydrateWizardFloorPlanDocOptions = {}
): FloorPlanDoc {
  if (eventId) {
    clearMultiRoomDraft(eventId)
  }

  const hasSavedGeometry =
    options.hydrateSavedObjects &&
    options.existingLayout &&
    ((options.existingLayout.layout_rooms?.length ?? 0) > 0 ||
      (options.existingLayout.cells?.length ?? 0) > 0)

  if (hasSavedGeometry) {
    const full = stripMergedZoneOverlays(
      forceRecomputeGeometry(docFromLegacyRooms(layoutRooms))
    )
    return full
  }

  return docWithRoomFramesOnly(layoutRooms)
}
