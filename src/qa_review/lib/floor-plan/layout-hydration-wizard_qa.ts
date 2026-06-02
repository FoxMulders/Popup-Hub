/**
 * Wizard Step 3 hydration — fully blank canvas on load (no rooms, no objects).
 * Clears stale localStorage multi-room drafts.
 */

import { stripMergedZoneOverlays } from '@/components/coordinator/floor-plan-v2/state/layout-hydration'
import { clearMultiRoomDraft } from '@/components/coordinator/floor-plan-v2/state/local-draft'
import { forceRecomputeGeometry } from '@/components/coordinator/floor-plan-v2/state/geometry-sanitize'
import { makeEmptyDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import type { FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import type { BoothLayout, LayoutRoom } from '@/types/database'
import { docFromLegacyRooms } from '@/components/coordinator/floor-plan-v2/state/legacy-bridge'

export interface HydrateWizardFloorPlanDocOptions {
  existingLayout?: BoothLayout | null
  /** Load saved booth/venue objects from server layout (edit existing market). */
  hydrateSavedObjects?: boolean
}

function blankWizardDoc(): FloorPlanDoc {
  return forceRecomputeGeometry({
    ...makeEmptyDoc(50, 50),
    rooms: [],
    objects: [],
    objectRoom: {},
  })
}

/**
 * Wizard floor plan initial doc:
 * - Clears multi-room localStorage draft (prevents frozen stale geometry).
 * - Default: empty 50×50 ft workspace — no room frames, no placed objects.
 * - Optional: full server layout when editing an existing saved market.
 */
export function hydrateFloorPlanDocForWizardQa(
  eventId: string | null | undefined,
  _layoutRooms: LayoutRoom[],
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
    return stripMergedZoneOverlays(
      forceRecomputeGeometry(docFromLegacyRooms(_layoutRooms))
    )
  }

  return blankWizardDoc()
}
