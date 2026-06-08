'use client'

import { useEffect, useState } from 'react'
import { MOBILE_VIEWPORT_MAX_PX } from './use-mobile-viewport'

/** Matches Tailwind `lg` — full desktop command-center rails from this width up. */
export const TABLET_VIEWPORT_MAX_PX = 1023

export type FloorPlanViewportTier = 'mobile' | 'tablet' | 'desktop'

export function floorPlanViewportTierFromWidth(width: number): FloorPlanViewportTier {
  if (width <= MOBILE_VIEWPORT_MAX_PX) return 'mobile'
  if (width <= TABLET_VIEWPORT_MAX_PX) return 'tablet'
  return 'desktop'
}

export function useFloorPlanViewportTier(): FloorPlanViewportTier {
  const [tier, setTier] = useState<FloorPlanViewportTier>('desktop')

  useEffect(() => {
    const sync = () => setTier(floorPlanViewportTierFromWidth(window.innerWidth))
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  return tier
}

/** True when the viewport is taller than it is wide (tablet rotation advisory). */
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
