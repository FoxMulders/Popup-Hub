'use client'

import { useCallback, useRef } from 'react'
import type { ViewportApi } from './use-viewport'
import { focusFloorPlanCanvas } from './canvas-focus'
import {
  boundsCentroid,
  ensureCanvasHasPlaceableRoom,
  unionActiveRoomBounds,
  type ViewportMatrix,
} from './canvas-engine'
import type { FloorPlanDocStore } from '../state/use-floor-plan-doc'
import {
  fitViewportToContent,
  VIEWPORT_FIT_PADDING,
} from './use-layout-viewport'

export interface UseCanvasWorkspaceOptions {
  store: FloorPlanDocStore
}

/**
 * Workspace orchestration: viewport matrix, center-on-rooms, focus recovery.
 */
export function useCanvasWorkspace({ store }: UseCanvasWorkspaceOptions) {
  const viewportApiRef = useRef<ViewportApi | null>(null)

  const bindViewport = useCallback((api: ViewportApi | null) => {
    viewportApiRef.current = api
  }, [])

  const recoverFocus = useCallback(() => {
    focusFloorPlanCanvas()
  }, [])

  const readViewportMatrix = useCallback((): ViewportMatrix => {
    const api = viewportApiRef.current
    const el = document.getElementById('floor-plan-canvas')
    return {
      zoom: api?.zoom ?? 1,
      panX: el?.scrollLeft ?? 0,
      panY: el?.scrollTop ?? 0,
    }
  }, [])

  /** Fit camera to the union of all active rooms (~75% of viewport). */
  const centerOnActiveRooms = useCallback(() => {
    const api = viewportApiRef.current
    if (!api) return
    const bounds = unionActiveRoomBounds(store.doc)
    if (bounds) {
      api.fitToBounds(bounds, { padding: VIEWPORT_FIT_PADDING })
    } else {
      fitViewportToContent(api, store.doc)
    }
    recoverFocus()
  }, [recoverFocus, store.doc])

  const resetViewportToOrigin = useCallback(() => {
    fitViewportToContent(viewportApiRef.current, store.doc)
    recoverFocus()
  }, [recoverFocus, store.doc])

  const ensurePlaceableDocument = useCallback(() => {
    const next = ensureCanvasHasPlaceableRoom(store.doc)
    if (next !== store.doc) {
      store.patchDoc(
        {
          rooms: next.rooms,
          canvasWidthFt: next.canvasWidthFt,
          canvasLengthFt: next.canvasLengthFt,
        },
        { pushHistory: true }
      )
      centerOnActiveRooms()
    }
    return next
  }, [centerOnActiveRooms, store])

  const afterToolbarAction = useCallback(() => {
    recoverFocus()
  }, [recoverFocus])

  return {
    viewportApiRef,
    bindViewport,
    recoverFocus,
    readViewportMatrix,
    centerOnActiveRooms,
    resetViewportToOrigin,
    ensurePlaceableDocument,
    afterToolbarAction,
    boundsCentroid,
    unionActiveRoomBounds,
  }
}
