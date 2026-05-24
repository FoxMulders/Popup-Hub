'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClipboardList, ExternalLink } from 'lucide-react'
import type { ApplicationStatus, BoothApplication } from '@/types/database'

export type PendingBoothApplicationRow = BoothApplication & {
  vendor?: { full_name: string | null; email: string | null } | null
  event?: { id: string; name: string; booking_mode?: string } | null
  category?: { name: string } | null
}

const STATUS_LABEL: Partial<Record<ApplicationStatus, string>> = {
  pending: 'Pending review',
  pending_insurance: 'Pending insurance',
}

interface PendingBoothApplicationsPanelProps {
  applications: PendingBoothApplicationRow[]
  hasEvents: boolean
  firstEventApplicationsHref?: string | null
}

export function PendingBoothApplicationsPanel({
  applications,
  hasEvents,
  firstEventApplicationsHref,
}: PendingBoothApplicationsPanelProps) {
  if (!hasEvents) {
    return null
  }

  if (applications.length === 0) {
    return (
      <div className="market-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-heading font-semibold">Booth applications</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              No booth applications awaiting review. When vendors apply to your{' '}
              <strong>juried</strong> markets, they appear here for approve / decline / waitlist.
              Instant-book markets approve vendors automatically on apply.
            </p>
          </div>
          {firstEventApplicationsHref ? (
            <Link href={firstEventApplicationsHref}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <ClipboardList className="h-4 w-4" />
                Open applications board
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="market-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading font-semibold">Booth applications awaiting action</h3>
          <p className="text-sm text-muted-foreground">
            Vendors who applied for booth space at your markets — review juried submissions here.
          </p>
        </div>
        <Badge className="bg-harvest-100 text-harvest-800">{applications.length} open</Badge>
      </div>

      <ul className="space-y-3">
        {applications.map((app) => {
          const vendor = Array.isArray(app.vendor) ? app.vendor[0] : app.vendor
          const event = Array.isArray(app.event) ? app.event[0] : app.event
          const category = Array.isArray(app.category) ? app.category[0] : app.category
          const reviewHref = event?.id
            ? `/coordinator/events/${event.id}/applications`
            : null

          return (
            <li key={app.id} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {vendor?.full_name ?? vendor?.email ?? 'Vendor'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {event?.name ?? 'Market'}
                    {category?.name ? ` · ${category.name}` : ''}
                  </p>
                  {app.applied_at ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Applied {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                    </p>
                  ) : null}
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {STATUS_LABEL[app.status] ?? app.status.replace('_', ' ')}
                </Badge>
              </div>
              {reviewHref ? (
                <Link
                  href={reviewHref}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-harvest-700 hover:underline"
                >
                  Review application
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
