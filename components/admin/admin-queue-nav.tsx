'use client'

import Link from 'next/link'
import { useAdminPendingCounts } from '@/hooks/use-admin-pending-counts'
import { Badge } from '@/components/ui/badge'

export function AdminQueueNav() {
  const { counts } = useAdminPendingCounts(true)

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      <Link
        href="/admin/users"
        className="relative rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted/60"
      >
        Users
      </Link>
      <Link
        href="/admin/feedback"
        className="relative rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted/60"
      >
        Feature requests
        {counts.featureRequests > 0 ? (
          <Badge className="ml-2 h-5 min-w-5 px-1.5 text-[10px] leading-none">
            {counts.featureRequests > 9 ? '9+' : counts.featureRequests}
          </Badge>
        ) : null}
      </Link>
      <Link
        href="/admin/organizer-claims"
        className="relative rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted/60"
      >
        Organizer claims
        {counts.organizerClaims > 0 ? (
          <Badge className="ml-2 h-5 min-w-5 px-1.5 text-[10px] leading-none">
            {counts.organizerClaims > 9 ? '9+' : counts.organizerClaims}
          </Badge>
        ) : null}
      </Link>
      <Link
        href="/admin/venues"
        className="relative rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-muted/60"
      >
        Venue submissions
        {counts.venueSubmissions > 0 ? (
          <Badge className="ml-2 h-5 min-w-5 px-1.5 text-[10px] leading-none">
            {counts.venueSubmissions > 9 ? '9+' : counts.venueSubmissions}
          </Badge>
        ) : null}
      </Link>
    </nav>
  )
}
