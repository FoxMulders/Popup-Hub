'use client'

import { CommandCenterExitLink } from '@/components/coordinator/command-center-exit-link'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { DashboardToolbarPortalTarget } from './dashboard-toolbar-portal'
import { useMarketManagement } from './market-management-context'

/**
 * Left utility rail — layout tool accordions only (no curation queue).
 */
export function DashboardLeftPanel() {
  const { selectedEventId, events } = useMarketManagement()
  const { setFullscreen } = useCommandCenterFullscreen()
  const selectedEvent = events.find((event) => event.id === selectedEventId)

  return (
    <div className="flex h-full min-h-0 w-full flex-col justify-start overflow-hidden bg-white">
      {selectedEventId ? (
        <div className="sticky top-0 z-[10001] shrink-0 border-b border-stone-200/80 bg-white/95 px-2 py-2 backdrop-blur-sm pointer-events-auto">
          <CommandCenterExitLink
            eventId={selectedEventId}
            eventName={selectedEvent?.name}
            eventStatus={selectedEvent?.status}
            compact
            prominent
            className="w-full justify-start"
            onBeforeNavigate={() => setFullscreen(false)}
          />
        </div>
      ) : null}
      <DashboardToolbarPortalTarget className="min-h-0 flex-1 overflow-y-auto border-b-0 px-1 py-1" />
    </div>
  )
}
