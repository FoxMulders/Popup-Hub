/**
 * Wizard Step 3 + layout editor hydration — blank canvas unless real geometry exists.
 * Clears stale localStorage multi-room drafts.
 */

import { docFromLegacyRooms } from '@/components/coordinator/floor-plan-v2/state/legacy-bridge'
import { stripMergedZoneOverlays } from '@/components/coordinator/floor-plan-v2/state/layout-hydration'
import {
  clearMultiRoomDraft,
  loadMultiRoomDraft,
} from '@/components/coordinator/floor-plan-v2/state/local-draft'
import { forceRecomputeGeometry } from '@/components/coordinator/floor-plan-v2/state/geometry-sanitize'
import { makeEmptyDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import type { FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import { layoutHasDrawableGeometry } from '@/lib/booth-planner/layout-rooms'
import type { BoothLayout, LayoutRoom } from '@/types/database'

export interface HydrateWizardFloorPlanDocOptions {
  existingLayout?: BoothLayout | null
  /** Load saved booth/venue objects from server layout (cells or venue_elements). */
  hydrateSavedObjects?: boolean
  /** Standalone layout editor — ignore localStorage draft, prefer server rows. */
  preferServerLayout?: boolean
}

/** @deprecated Use `layoutHasDrawableGeometry` from `@/lib/booth-planner/layout-rooms`. */
export function layoutHasPlacedGeometry(layout: BoothLayout | null | undefined): boolean {
  return layoutHasDrawableGeometry(layout)
}

function blankWizardDoc(): FloorPlanDoc {
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

/**
 * Floor plan initial doc:
 * - Clears multi-room localStorage draft (prevents frozen stale geometry).
 * - Default: empty 50×50 ft workspace — no room frames, no placed objects.
 * - Hydrates server/draft geometry only when cells or venue_elements exist.
 */
export function hydrateFloorPlanDocForWizardQa(
  eventId: string | null | undefined,
  layoutRooms: LayoutRoom[],
  options: HydrateWizardFloorPlanDocOptions = {}
): FloorPlanDoc {
  const { preferServerLayout = false } = options
  const shouldHydrate =
    options.hydrateSavedObjects ??
    layoutHasPlacedGeometry(options.existingLayout)

  if (eventId) {
    if (preferServerLayout || !shouldHydrate) {
      clearMultiRoomDraft(eventId)
    }
  }

  if (shouldHydrate && layoutRooms.length > 0) {
    return docFromSavedLayout(layoutRooms)
  }

  if (eventId && !preferServerLayout && !shouldHydrate) {
    if (layoutRooms.length === 0) {
      clearMultiRoomDraft(eventId)
      return blankWizardDoc()
    }
    const cached = loadMultiRoomDraft(eventId)
    const cachedObjects = cached?.doc?.objects?.length ?? 0
    const cachedRooms = cached?.doc?.rooms?.length ?? 0
    if (cached?.doc && (cachedObjects > 0 || cachedRooms > 0)) {
      return stripMergedZoneOverlays(forceRecomputeGeometry(cached.doc))
    }
    clearMultiRoomDraft(eventId)
  }

  return blankWizardDoc()
}
