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
 * Fixed safe-zone on every side when framing content at the baseline
 * (100%) zoom level. Preferred over percentage padding for layout load.
 */
export const VIEWPORT_FIT_PADDING_PX = 40

/**
 * Side margin for fit-to-viewport framing. With padding `p`, content
 * occupies `(1 - 2p)` of the viewport — 0.125 → ~75% (within 70–80%).
 */
export const VIEWPORT_FIT_PADDING = 0.125

/** Edge-to-edge grid framing on the command-center dashboard. */
export const COMMAND_CENTER_FIT_PADDING = 0

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
  paddingPx?: number
  commandCenterViewport?: boolean
}

/**
 * Dynamically zoom and pan so advisory canvas bounds fit inside the
 * visible editor viewport. Baseline (100%) uses a 40px safe-zone on
 * every side unless overridden.
 */
export function fitViewportToContent(
  viewportApi: ViewportApi | null,
  doc: FloorPlanDoc,
  activeRoomId?: string | null,
  options?: FitViewportToContentOptions
): number | undefined {
  if (!viewportApi) return undefined
  const paddingPx =
    options?.paddingPx ??
    (options?.commandCenterViewport ? undefined : VIEWPORT_FIT_PADDING_PX)
  const padding =
    options?.padding ??
    (options?.commandCenterViewport
      ? COMMAND_CENTER_FIT_PADDING
      : paddingPx
        ? undefined
        : VIEWPORT_FIT_PADDING)
  return viewportApi.fitToBounds(contentFramingBounds(doc, activeRoomId), {
    padding,
    paddingPx,
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
