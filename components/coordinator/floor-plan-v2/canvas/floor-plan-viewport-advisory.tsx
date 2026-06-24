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

/** Viewport tier + iron-dome flags for the coordinator floor-plan canvas. */
export function useFloorPlanViewportLayout(): FloorPlanViewportLayoutContextValue {
  return useContext(FloorPlanViewportLayoutContext) ?? FALLBACK_LAYOUT
}

export function FloorPlanViewportLayoutProvider({ children }: { children: ReactNode }) {
  const { width, height } = useFloorPlanViewportDimensions()
  const pocketSized = isPocketSizedViewport(width, height)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const canvasHost = document.querySelector('.floor-plan-canvas-host--dashboard')
    if (!canvasHost) {
      document.documentElement.style.removeProperty('--canvas-area-ratio')
      return
    }
    const ratio = canvasHost.getBoundingClientRect().height / window.innerHeight
    document.documentElement.style.setProperty('--canvas-area-ratio', ratio.toFixed(3))
  }, [width, height])

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
  title?: string
  description?: ReactNode
  minimumViewportCopy?: ReactNode
  exitLabel?: string
}

export const FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING =
  'The floor plan matrix is not optimized for small screens.'

export const FLOOR_PLAN_DESKTOP_BREAKPOINT_COPY =
  'Recommended layout desktop size: at least 1024px wide and 550px tall.'

/** Full-screen gate — layout canvas unmounted on pocket-sized viewports. */
export function DesktopScreenRequiredOverlay({
  eventId: eventIdProp,
  onSaveDraft,
  saveDraftLoading = false,
  title = 'Layout needs a larger screen',
  description,
  minimumViewportCopy,
  exitLabel,
}: DesktopScreenRequiredOverlayProps = {}) {
  const { showDesktopRequired } = useFloorPlanViewportLayout()
  const marketMgmt = useOptionalMarketManagement()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)

  const eventId = eventIdProp ?? marketMgmt?.selectedEventId ?? null
  const overlayDescription =
    description ??
    'The floor plan designer needs a tablet in landscape or a desktop monitor. Your market details are safe — save a draft now and continue layout on a bigger screen.'
  const overlayMinimumCopy =
    minimumViewportCopy ?? (
      <>
        Minimum viewport: 1024px wide and 550px tall. {FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING}{' '}
        Phones are blocked; most tablets in landscape work fine.
      </>
    )
  const resolvedExitLabel =
    exitLabel ?? (onSaveDraft ? 'Exit without saving' : eventId ? 'Back to event' : 'Back to HubGrid')

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
          {title}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-stone-300">
          {overlayDescription}
        </p>

        <div className="mt-4 rounded-lg border border-stone-700 bg-stone-800/50 p-4 text-sm text-stone-400">
          {overlayMinimumCopy}
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
            {resolvedExitLabel}
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

/** @deprecated Iron dome blocks all sub-desktop viewports — banner is no longer shown. */
export function TabletLandscapeAdvisoryBanner() {
  return null
}
