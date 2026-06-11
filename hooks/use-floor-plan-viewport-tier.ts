'use client'

import { useEffect, useState } from 'react'

/** Matches Tailwind `lg` — layout canvas requires at least this width. */
export const FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX = 1024

/** Squished viewports (landscape phones, short windows) fall below this height. */
export const FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX = 550

/** @deprecated Iron dome uses {@link FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX} minus one. */
export const TABLET_VIEWPORT_MAX_PX = FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX - 1

/** @deprecated Use {@link FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}. */
export const MIN_FLOOR_PLAN_VIEWPORT_HEIGHT_PX = FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX

export type FloorPlanViewportTier = 'mobile' | 'tablet' | 'desktop'

export interface FloorPlanViewportDimensions {
  width: number
  height: number
}

/** Stop phone gymnasts in their tracks — width OR height too small for CAD. */
export function isPocketSizedViewport(width: number, height: number): boolean {
  return width < FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX || height < FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX
}

export function floorPlanViewportTierFromDimensions(
  width: number,
  height: number
): FloorPlanViewportTier {
  if (isPocketSizedViewport(width, height)) return 'mobile'
  return 'desktop'
}

/** @deprecated Prefer {@link isPocketSizedViewport} / {@link floorPlanViewportTierFromDimensions}. */
export function isShortLandscapePhoneViewport(width: number, height: number): boolean {
  return isPocketSizedViewport(width, height)
}

/** @deprecated Prefer {@link floorPlanViewportTierFromDimensions}. */
export function floorPlanViewportTierFromWidth(width: number): FloorPlanViewportTier {
  return floorPlanViewportTierFromDimensions(
    width,
    typeof window !== 'undefined' ? window.innerHeight : 800
  )
}

export function useFloorPlanViewportDimensions(): FloorPlanViewportDimensions | null {
  const [dimensions, setDimensions] = useState<FloorPlanViewportDimensions | null>(null)

  useEffect(() => {
    const sync = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  return dimensions
}

export function useIsPocketSizedViewport(): boolean {
  const dimensions = useFloorPlanViewportDimensions()
  if (!dimensions) return true
  return isPocketSizedViewport(dimensions.width, dimensions.height)
}

export function useFloorPlanViewportTier(): FloorPlanViewportTier {
  const dimensions = useFloorPlanViewportDimensions()
  if (!dimensions) return 'mobile'
  return floorPlanViewportTierFromDimensions(dimensions.width, dimensions.height)
}

/** True when the viewport is taller than it is wide. */
export function useViewportPortrait(): boolean {
  const [portrait, setPortrait] = useState(false)

  useEffect(() => {
    const sync = () => setPortrait(window.innerHeight > window.innerWidth)
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  return portrait
}
