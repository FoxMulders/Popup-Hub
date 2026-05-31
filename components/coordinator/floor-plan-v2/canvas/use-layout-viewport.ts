'use client'

import { useCallback } from 'react'
import {
  boundsCenter,
  unionRoomBounds,
  type LayoutViewportMatrix,
} from '../state/layout-builder-core'
import type { FloorPlanDoc } from '../state/types'
import type { ViewportApi } from './use-viewport'

/** Derive pan from scroll position (call after scroll/zoom events, not during render). */
export function scrollToViewportMatrix(
  scrollLeft: number,
  scrollTop: number,
  zoom: number,
  basePxPerFt: number,
  padFt: number
): LayoutViewportMatrix {
  const padPx = padFt * basePxPerFt * zoom
  return {
    zoom,
    panX: (scrollLeft - padPx) / zoom,
    panY: (scrollTop - padPx) / zoom,
  }
}

export function useCenterOnRooms(
  doc: FloorPlanDoc,
  viewportApi: ViewportApi | null
): () => void {
  return useCallback(() => {
    if (!viewportApi) return
    const bounds = unionRoomBounds(doc)
    if (bounds) {
      viewportApi.fitToBounds(bounds, { padding: 0.12 })
      return
    }
    viewportApi.resetViewport()
  }, [doc, viewportApi])
}

export function resetLayoutViewport(
  viewportApi: ViewportApi | null
): void {
  viewportApi?.resetViewport()
}

export { boundsCenter }
