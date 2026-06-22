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

export const FLOOR_PLAN_SMALL_SCREEN_REGRESSION_MESSAGE =
  'The floor plan matrix is not optimized for small screens. Use a desktop-sized layout at least 1024px wide and 550px tall to edit HubGrid.'

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

/** Full-screen gate for pocket-sized viewports. */
export function DesktopScreenRequiredOverlay({
  eventId: eventIdProp,
  onSaveDraft,
  saveDraftLoading = false,
}: DesktopScreenRequiredOverlayProps = {}) {
  const { showDesktopRequired } = useFloorPlanViewportLayout()
  const marketMgmt = useOptionalMarketManagement()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const eventId = eventIdProp ?? marketMgmt?.selectedEventId ?? null

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

  if (!showDesktopRequired || typeof document === 'undefined') return null

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
          details are safe
          {onSaveDraft ? ' — save a draft now and continue' : ' — continue layout'} on a bigger
          screen.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-amber-100">
          {FLOOR_PLAN_SMALL_SCREEN_REGRESSION_MESSAGE}
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
      <p className="mt-2 text-amber-900/90">
        {FLOOR_PLAN_SMALL_SCREEN_REGRESSION_MESSAGE}
      </p>
    </div>
  )
}

/** @deprecated Iron dome blocks all sub-desktop viewports — banner is no longer shown. */
export function TabletLandscapeAdvisoryBanner() {
  return null
}
