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
import { Monitor, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { COORDINATOR_STUDIO_PATH } from '@/lib/coordinator/coordinator-routes'
import { useOptionalMarketManagement } from '@/components/coordinator/dashboard/market-management-context'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
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

export interface DesktopScreenRequiredOverlayProps {
  eventId?: string | null
  onSaveDraft?: () => void | Promise<void>
  saveDraftLoading?: boolean
}

/** Full-screen gate — layout canvas unmounted on pocket-sized viewports. */
export function DesktopScreenRequiredOverlay({
  eventId: eventIdProp,
  onSaveDraft,
  saveDraftLoading = false,
}: DesktopScreenRequiredOverlayProps = {}) {
  const { showDesktopRequired } = useFloorPlanViewportLayout()
  const marketMgmt = useOptionalMarketManagement()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)

  const eventId = eventIdProp ?? marketMgmt?.selectedEventId ?? null

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

  const navigateAway = useCallback(() => {
    router.push(eventId ? `/coordinator/events/${eventId}` : COORDINATOR_STUDIO_PATH)
  }, [eventId, router])

  const handleSaveDraft = useCallback(async () => {
    if (onSaveDraft) {
      setSaving(true)
      try {
        await onSaveDraft()
      } finally {
        setSaving(false)
      }
      navigateAway()
      return
    }
    navigateAway()
  }, [navigateAway, onSaveDraft])

  if (!showDesktopRequired || !mounted) return null

  const overlay = (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center overflow-y-auto bg-stone-950/90 p-4 sm:p-6 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pocket-viewport-title"
      data-testid="floor-plan-desktop-required"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 text-left shadow-xl sm:p-8">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-forest/15 text-forest">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>

        <h2
          id="pocket-viewport-title"
          className="font-heading text-xl font-bold tracking-tight text-stone-50 sm:text-2xl"
        >
          Layout needs a larger screen
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-stone-300">
          The floor plan designer needs a tablet in landscape or a desktop monitor. Your market
          details are safe — save a draft now and continue layout on a bigger screen.
        </p>

        <div className="mt-4 rounded-lg border border-stone-700 bg-stone-800/50 p-4 text-sm text-stone-400">
          Minimum viewport: 1024px wide and 550px tall. Phones are blocked; most tablets in
          landscape work fine.
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {onSaveDraft ? (
            <Button
              type="button"
              size="lg"
              disabled={saving || saveDraftLoading}
              onClick={() => void handleSaveDraft()}
              className="min-h-12 flex-1 touch-manipulation gap-2"
              data-testid="floor-plan-save-draft-exit"
            >
              <Save className="h-4 w-4" aria-hidden />
              {saving || saveDraftLoading ? 'Saving…' : 'Save draft & exit'}
            </Button>
          ) : null}
          <Button
            type="button"
            size="lg"
            variant={onSaveDraft ? 'outline' : 'default'}
            onClick={navigateAway}
            className="min-h-12 flex-1 touch-manipulation border-stone-600 text-stone-100 hover:bg-stone-800"
            data-testid="floor-plan-desktop-required-exit"
          >
            {onSaveDraft ? 'Exit without saving' : 'Back to event'}
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

/** Banner shown on event hub when redirected from mobile layout route. */
export function DesktopLayoutRequiredBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950',
        className
      )}
      role="status"
    >
      <p className="font-semibold">Floor plan layout requires a tablet or desktop</p>
      <p className="mt-1 text-amber-900/90">
        Open this market on a larger screen to design booths in HubGrid or the setup
        wizard layout step.
      </p>
    </div>
  )
}

/** Defensive matrix copy for standalone ledger views on phone-sized or cramped windows. */
export function FloorPlanMatrixViewportWarning({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[320px] items-center justify-center bg-stone-950 p-4 text-stone-50 sm:p-6',
        className
      )}
      role="status"
      data-testid="floor-plan-matrix-small-screen-warning"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-300/40 bg-stone-900 p-6 shadow-xl sm:p-8">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-300/15 text-amber-200">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
          Floor plan matrix needs desktop space
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-300">
          The floor plan matrix is not optimized for small screens. Open HubGrid on a
          desktop-sized layout before reviewing booth assignments or using dual-screen mode.
        </p>
        <p className="mt-4 rounded-lg border border-stone-700 bg-stone-800/70 p-4 text-sm text-stone-300">
          Recommended layout: at least {FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide and{' '}
          {FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX}px tall.
        </p>
      </div>
    </div>
  )
}

/** @deprecated Iron dome blocks all sub-desktop viewports — banner is no longer shown. */
export function TabletLandscapeAdvisoryBanner() {
  return null
}
