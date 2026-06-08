'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Monitor } from 'lucide-react'
import {
  useFloorPlanViewportTier,
  useViewportPortrait,
  type FloorPlanViewportTier,
} from '@/hooks/use-floor-plan-viewport-tier'

export interface FloorPlanViewportLayoutContextValue {
  tier: FloorPlanViewportTier
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isTabletPortrait: boolean
  showDesktopRequired: boolean
  showLandscapeAdvisory: boolean
}

const FloorPlanViewportLayoutContext =
  createContext<FloorPlanViewportLayoutContextValue | null>(null)

const FALLBACK_LAYOUT: FloorPlanViewportLayoutContextValue = {
  tier: 'desktop',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTabletPortrait: false,
  showDesktopRequired: false,
  showLandscapeAdvisory: false,
}

/** Viewport tier + orientation flags for the coordinator floor-plan canvas. */
export function useFloorPlanViewportLayout(): FloorPlanViewportLayoutContextValue {
  return useContext(FloorPlanViewportLayoutContext) ?? FALLBACK_LAYOUT
}

export function FloorPlanViewportLayoutProvider({ children }: { children: ReactNode }) {
  const tier = useFloorPlanViewportTier()
  const portrait = useViewportPortrait()

  const value = useMemo<FloorPlanViewportLayoutContextValue>(() => {
    const isMobile = tier === 'mobile'
    const isTablet = tier === 'tablet'
    const isDesktop = tier === 'desktop'
    const isTabletPortrait = isTablet && portrait
    return {
      tier,
      isMobile,
      isTablet,
      isDesktop,
      isTabletPortrait,
      showDesktopRequired: isMobile,
      showLandscapeAdvisory: isTabletPortrait,
    }
  }, [portrait, tier])

  return (
    <FloorPlanViewportLayoutContext.Provider value={value}>
      {children}
    </FloorPlanViewportLayoutContext.Provider>
  )
}

/** Full-screen gate for phones — canvas stays unmounted behind this overlay. */
export function DesktopScreenRequiredOverlay() {
  const { showDesktopRequired } = useFloorPlanViewportLayout()
  if (!showDesktopRequired) return null

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-canvas/95 p-6 text-center backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desktop-required-title"
      data-testid="floor-plan-desktop-required"
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest/10 text-forest">
        <Monitor className="h-7 w-7" aria-hidden />
      </span>
      <h2
        id="desktop-required-title"
        className="font-heading text-xl font-semibold text-foreground sm:text-2xl"
      >
        Desktop Screen Required
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The booth layout canvas needs a wider screen. Open this page on a tablet in landscape
        mode or on a desktop computer to design your floor plan.
      </p>
    </div>
  )
}

/** Fixed advisory while a tablet is held in portrait orientation. */
export function TabletLandscapeAdvisoryBanner() {
  const { showLandscapeAdvisory } = useFloorPlanViewportLayout()
  if (!showLandscapeAdvisory) return null

  return (
    <div
      className="fixed inset-x-0 top-0 z-[9990] border-b border-amber-300/80 bg-amber-50 px-3 py-2.5 text-center text-xs font-medium leading-snug text-amber-950 sm:text-sm"
      role="status"
      data-testid="floor-plan-tablet-landscape-advisory"
    >
      🔄 Landscape Mode Recommended: Please rotate your tablet for a wider view of the layout
      canvas.
    </div>
  )
}
