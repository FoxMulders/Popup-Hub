'use client'

import { useCallback } from 'react'
import {
  boundsCenter,
  unionRoomBounds,
  type LayoutViewportMatrix,
} from '../state/layout-builder-core'
import {
  activeRoomFramingBounds,
  type FtBounds,
} from '../state/room-canvas'
import type { FloorPlanDoc } from '../state/types'
import type { ViewportApi } from './use-viewport'

/**
 * Side margin for fit-to-viewport framing. With padding `p`, content
 * occupies `(1 - 2p)` of the viewport — 0.125 → ~75% (within 70–80%).
 */
export const VIEWPORT_FIT_PADDING = 0.125

/** Tighter framing for command-center dashboard chrome. */
export const COMMAND_CENTER_FIT_PADDING = 0.06

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

/**
 * Bounding box to frame on load / room resize: active room footprint
 * (plus in-room objects), or the open canvas when no rooms exist.
 */
export function contentFramingBounds(
  doc: FloorPlanDoc,
  activeRoomId?: string | null
): FtBounds {
  const frames = doc.rooms ?? []
  if (frames.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: doc.canvasWidthFt,
      maxY: doc.canvasLengthFt,
    }
  }
  return activeRoomFramingBounds(
    frames,
    activeRoomId,
    doc.objects,
    doc.objectRoom
  )
}

export interface FitViewportToContentOptions {
  padding?: number
  commandCenterViewport?: boolean
}

/**
 * Dynamically zoom and pan so `bounds` fill ~70–80% of the visible
 * editor viewport. Replaces hard-coded zoom-1 / canvas-centre resets.
 */
export function fitViewportToContent(
  viewportApi: ViewportApi | null,
  doc: FloorPlanDoc,
  activeRoomId?: string | null,
  options?: FitViewportToContentOptions
): void {
  if (!viewportApi) return
  const padding =
    options?.padding ??
    (options?.commandCenterViewport
      ? COMMAND_CENTER_FIT_PADDING
      : VIEWPORT_FIT_PADDING)
  viewportApi.fitToBounds(contentFramingBounds(doc, activeRoomId), {
    padding,
  })
}

export function useCenterOnRooms(
  doc: FloorPlanDoc,
  viewportApi: ViewportApi | null
): () => void {
  return useCallback(() => {
    if (!viewportApi) return
    const bounds = unionRoomBounds(doc)
    if (bounds) {
      viewportApi.fitToBounds(bounds, { padding: VIEWPORT_FIT_PADDING })
      return
    }
    fitViewportToContent(viewportApi, doc)
  }, [doc, viewportApi])
}

export function resetLayoutViewport(
  viewportApi: ViewportApi | null,
  doc?: FloorPlanDoc,
  activeRoomId?: string | null
): void {
  if (doc) {
    fitViewportToContent(viewportApi, doc, activeRoomId)
    return
  }
  viewportApi?.resetViewport()
}

export { boundsCenter }
