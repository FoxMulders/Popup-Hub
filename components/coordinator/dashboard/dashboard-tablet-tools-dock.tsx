'use client'

import { useEffect, useState } from 'react'
import { LayoutGrid, Menu, X } from 'lucide-react'
import { CommandCenterExitLink } from '@/components/coordinator/command-center-exit-link'
import { cn } from '@/lib/utils'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { DashboardToolbarPortalTarget } from './dashboard-toolbar-portal'
import { useFloorPlanViewportLayout } from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'
import { useMarketManagement } from './market-management-context'

/**
 * Tablet command-center rail — collapsed icon dock with a sliding drawer
 * for the full layout toolbar (portaled from FloorPlanV2).
 */
export function DashboardTabletToolsDock() {
  const { isTablet, showLandscapeAdvisory } = useFloorPlanViewportLayout()
  const { selectedEventId, events } = useMarketManagement()
  const { setFullscreen } = useCommandCenterFullscreen()
  const selectedEvent = events.find((event) => event.id === selectedEventId)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!isTablet) setDrawerOpen(false)
  }, [isTablet])

  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  if (!isTablet) return null

  return (
    <>
      <div className="flex h-full w-full flex-col items-center gap-2 py-2">
        <button
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          aria-expanded={drawerOpen}
          aria-controls="dashboard-tablet-tools-drawer"
          aria-label={drawerOpen ? 'Close layout tools' : 'Open layout tools'}
          className={cn(
            'touch-target inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm transition-colors hover:bg-stone-50',
            drawerOpen && 'border-forest/40 bg-forest/5 text-forest'
          )}
        >
          {drawerOpen ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </button>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md text-forest/70"
          title="Layout tools"
          aria-hidden
        >
          <LayoutGrid className="h-4 w-4" />
        </span>
      </div>

      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close layout tools drawer"
          className="fixed inset-0 z-[120] bg-slate-900/35 backdrop-blur-[1px] md:block lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <aside
        id="dashboard-tablet-tools-drawer"
        aria-label="Layout tools drawer"
        aria-hidden={!drawerOpen}
        className={cn(
          'fixed bottom-0 left-0 top-0 z-[130] flex w-[min(20rem,calc(100vw-3rem))] flex-col border-r border-stone-200 bg-white shadow-xl transition-transform duration-200 ease-out md:flex lg:hidden',
          showLandscapeAdvisory ? 'pt-12' : 'pt-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        )}
      >
        <div className="flex flex-col gap-2 border-b border-stone-200/80 px-3 py-2">
          {selectedEventId ? (
            <CommandCenterExitLink
              eventId={selectedEventId}
              eventName={selectedEvent?.name}
              eventStatus={selectedEvent?.status}
              compact
              prominent
              className="w-full justify-start"
              onBeforeNavigate={() => {
                setFullscreen(false)
                setDrawerOpen(false)
              }}
            />
          ) : null}
          <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Layout tools
          </p>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close layout tools drawer"
            className="touch-target inline-flex h-10 w-10 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          </div>
        </div>
        <DashboardToolbarPortalTarget className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto border-b-0 px-2 py-2" />
      </aside>
    </>
  )
}
