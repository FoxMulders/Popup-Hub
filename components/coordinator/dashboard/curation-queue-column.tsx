'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ClipboardList, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { useMarketManagement } from './market-management-context'
import { VendorPoolShelf } from './vendor-pool-shelf'
import { DashboardToolbarPortalTarget } from './dashboard-toolbar-portal'
import { cn } from '@/lib/utils'

export function CurationQueueColumn() {
  const { pendingApplications, approvedPool, events, selectedEventId, setSelectedEventId } =
    useMarketManagement()

  const selectedEvent = events.find((e) => e.id === selectedEventId)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DashboardToolbarPortalTarget />
      <div className="market-panel-header shrink-0 rounded-none border-0 border-b border-stone-200/80 bg-gradient-to-r from-card via-card to-emerald-50/30 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90">
              Curation queue
            </p>
            <h2 className="market-panel-title text-base">Market intake</h2>
          </div>
        </div>
        <Badge variant="outline" className="border-harvest-300 bg-harvest-50 text-harvest-800 shrink-0">
          {pendingApplications.length} pending
        </Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-3 space-y-2">
          <label htmlFor="market-profile-select" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Active market profile
          </label>
          <select
            id="market-profile-select"
            value={selectedEventId ?? ''}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          {selectedEvent ? (
            <p className="text-[11px] text-muted-foreground">
              Starts {formatDistanceToNow(new Date(selectedEvent.start_at), { addSuffix: true })}
            </p>
          ) : null}
        </div>

        <AnimatePresence mode="popLayout">
          {pendingApplications.length === 0 ? (
            <motion.p
              key="empty-pending"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-xl border border-dashed border-stone-300 bg-stone-50/80 px-3 py-4 text-sm text-muted-foreground"
            >
              No applications awaiting review for this market.
            </motion.p>
          ) : (
            <motion.ul
              key="pending-list"
              layout
              className="space-y-2"
              role="list"
              aria-label="Pending booth applications"
            >
              {pendingApplications.slice(0, 8).map((app) => (
                <motion.li
                  key={app.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                >
                  <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm ring-1 ring-stone-100">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {app.vendorName ?? 'Vendor'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {app.categoryName ?? 'Uncategorized'}
                    </p>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        {pendingApplications.length > 0 && selectedEventId ? (
          <Link
            href={`/coordinator/events/${selectedEventId}/applications`}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'mt-3 w-full gap-1.5'
            )}
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
            Review all applications
          </Link>
        ) : null}

        <div className="mt-5 border-t border-stone-200/80 pt-4">
          <VendorPoolShelf vendors={approvedPool} />
        </div>
      </div>
    </div>
  )
}
