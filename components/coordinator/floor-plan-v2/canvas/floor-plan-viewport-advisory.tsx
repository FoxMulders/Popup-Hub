'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { useOptionalMarketManagement } from '@/components/coordinator/dashboard/market-management-context'
import {
  isPocketSizedViewport,
  useFloorPlanViewportDimensions,
  type FloorPlanViewportTier,
} from '@/hooks/use-floor-plan-viewport-tier'
import { cn } from '@/lib/utils'

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

/** Viewport tier + iron-dome flags for the coordinator floor-plan canvas. */
export function useFloorPlanViewportLayout(): FloorPlanViewportLayoutContextValue {
  return useContext(FloorPlanViewportLayoutContext) ?? FALLBACK_LAYOUT
}

export function FloorPlanViewportLayoutProvider({ children }: { children: ReactNode }) {
  const { width, height } = useFloorPlanViewportDimensions()
  const pocketSized = isPocketSizedViewport(width, height)

  const value = useMemo<FloorPlanViewportLayoutContextValue>(() => {
    return {
      tier: pocketSized ? 'mobile' : 'desktop',
      isMobile: pocketSized,
      isTablet: false,
      isDesktop: !pocketSized,
      isTabletPortrait: false,
      showDesktopRequired: pocketSized,
      showLandscapeAdvisory: false,
    }
  }, [pocketSized])

  return (
    <FloorPlanViewportLayoutContext.Provider value={value}>
      {children}
    </FloorPlanViewportLayoutContext.Provider>
  )
}

const BLUEPRINT_GRID_CLASS =
  'bg-slate-950 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]'

export const FLOOR_PLAN_DESKTOP_REQUIRED_TITLE =
  'Floor plan matrix needs a desktop-sized screen'

export const FLOOR_PLAN_DESKTOP_REQUIRED_MESSAGE =
  'The floor plan matrix is not optimized for small screens. Reopen Blueprint Studio on a desktop-sized viewport (at least 1024px wide and 550px tall) to edit the layout safely.'

export interface DesktopScreenRequiredOverlayProps {
  exitHref?: string
  exitLabel?: string
  message?: string
}

/** Full-screen iron-dome gate — canvas unmounted; cyber-arcade fallback UI. */
export function DesktopScreenRequiredOverlay({
  exitHref,
  exitLabel = 'Abort Mission & Go Back 🚀',
  message = FLOOR_PLAN_DESKTOP_REQUIRED_MESSAGE,
}: DesktopScreenRequiredOverlayProps = {}) {
  const { showDesktopRequired } = useFloorPlanViewportLayout()
  const marketManagement = useOptionalMarketManagement()
  const selectedEventId = marketManagement?.selectedEventId
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!showDesktopRequired) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showDesktopRequired])

  const handleAbortMission = useCallback(() => {
    router.push(
      exitHref ??
        (selectedEventId
          ? `/coordinator/events/${selectedEventId}`
          : '/coordinator/dashboard')
    )
  }, [exitHref, router, selectedEventId])

  if (!showDesktopRequired || !mounted) return null

  const overlay = (
    <div
      className={cn(
        'fixed inset-0 z-[10001] flex items-center justify-center overflow-y-auto p-4 sm:p-6 pointer-events-auto',
        BLUEPRINT_GRID_CLASS
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pocket-viewport-title"
      data-testid="floor-plan-desktop-required"
    >
      <div
        className={cn(
          'relative w-full max-w-lg rounded-2xl border border-amber-500/35 bg-slate-900/95 p-6 text-left shadow-[0_0_20px_rgba(234,179,8,0.15)] backdrop-blur-sm sm:p-8',
          'animate-in fade-in zoom-in-95 duration-300'
        )}
      >
        <p
          className="mb-4 inline-flex gap-2 text-3xl motion-safe:animate-[spin_8s_linear_infinite]"
          aria-hidden
        >
          <span className="inline-block motion-safe:animate-bounce">📐</span>
          <span className="inline-block motion-safe:animate-pulse">🤖</span>
          <span className="inline-block motion-safe:animate-bounce [animation-delay:150ms]">
            🚧
          </span>
        </p>

        <h2
          id="pocket-viewport-title"
          className="font-heading text-xl font-bold tracking-tight text-amber-50 sm:text-2xl"
        >
          Whoa there, Ant-Man! 🐜
        </h2>

        <p
          className="mt-2 text-sm font-semibold text-amber-200/90 sm:text-base"
          data-testid="floor-plan-desktop-required-message"
        >
          {message}
        </p>

        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          You are trying to orchestrate an entire physical marketplace on a screen meant for
          checking text messages. To snap doors flat, give those yellow vendor tables their
          mandatory 360-degree, 2-foot breathing rooms, and summon our Gemini-powered traffic
          flow wizard, you are going to need a bigger boat. Or, you know... a regular desktop
          monitor.
        </p>

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm leading-relaxed text-slate-300">
          💡 Pro-Tip: Go find a laptop, grab a coffee, and orchestrate the ultimate floor plan
          layout like the real operational mastermind you are.
        </div>

        <Button
          type="button"
          size="lg"
          onClick={handleAbortMission}
          className={cn(
            'touch-target mt-6 min-h-12 w-full touch-manipulation',
            'bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400',
            'shadow-[0_0_16px_rgba(234,179,8,0.35)]'
          )}
          data-testid="floor-plan-desktop-required-exit"
        >
          {exitLabel}
        </Button>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

export function FloorPlanDesktopRequiredNotice({
  className,
  message = FLOOR_PLAN_DESKTOP_REQUIRED_MESSAGE,
}: {
  className?: string
  message?: string
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[40vh] items-center justify-center p-6 text-center',
        className
      )}
      data-testid="floor-plan-desktop-required-notice"
    >
      <div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide">
          {FLOOR_PLAN_DESKTOP_REQUIRED_TITLE}
        </p>
        <p className="mt-2 text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  )
}

export interface FloorPlanDesktopRequiredGateProps
  extends DesktopScreenRequiredOverlayProps {
  children: ReactNode
  fallback?: ReactNode
  fallbackClassName?: string
}

export function FloorPlanDesktopRequiredGate({
  children,
  fallback,
  fallbackClassName,
  ...overlayProps
}: FloorPlanDesktopRequiredGateProps) {
  const { showDesktopRequired } = useFloorPlanViewportLayout()

  return (
    <>
      <DesktopScreenRequiredOverlay {...overlayProps} />
      {showDesktopRequired ? (
        fallback ?? <FloorPlanDesktopRequiredNotice className={fallbackClassName} />
      ) : (
        children
      )}
    </>
  )
}

/** @deprecated Iron dome blocks all sub-desktop viewports — banner is no longer shown. */
export function TabletLandscapeAdvisoryBanner() {
  return null
}
