'use client'

import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import {
  computePatronAisleOverlayForRoom,
  type PatronAisleRect,
} from '@/lib/floor-plan/patron-aisle-overlay'
import type { FloorPlanDoc } from '../state/types'

/**
 * Patron aisle corridor overlay — deferred so canvas edits paint first.
 */
export function usePatronAisleOverlay(
  doc: FloorPlanDoc,
  roomId: string | null | undefined,
  enabled: boolean
): PatronAisleRect[] | null {
  const deferredDoc = useDeferredValue(doc)
  const deferredRoomId = useDeferredValue(roomId)
  const deferredEnabled = useDeferredValue(enabled)

  const [corridors, setCorridors] = useState<PatronAisleRect[] | null>(null)

  useEffect(() => {
    if (!deferredEnabled || !deferredRoomId) {
      setCorridors(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      startTransition(() => {
        if (cancelled) return
        setCorridors(
          computePatronAisleOverlayForRoom(deferredDoc, deferredRoomId)
        )
      })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [deferredDoc, deferredRoomId, deferredEnabled])

  return corridors
}
