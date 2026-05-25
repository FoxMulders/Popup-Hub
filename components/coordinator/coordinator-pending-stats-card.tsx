'use client'

import Link from 'next/link'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CoordinatorPendingStatsCardProps {
  pendingCount: number
  pendingHref: string | null
  pendingEventName?: string | null
}

export function CoordinatorPendingStatsCard({
  pendingCount,
  pendingHref,
  pendingEventName,
}: CoordinatorPendingStatsCardProps) {
  const content = (
    <>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Booth Applications
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-harvest-500" />
          <span className="text-2xl font-bold">{pendingCount}</span>
        </div>
        {pendingCount > 0 && pendingHref ? (
          <p className="text-xs font-medium text-harvest-700">
            Review{pendingEventName ? ` · ${pendingEventName}` : ''} →
          </p>
        ) : pendingCount > 0 ? (
          <p className="text-xs text-muted-foreground">Open the list below to review</p>
        ) : null}
      </CardContent>
    </>
  )

  if (pendingCount > 0 && pendingHref) {
    return (
      <Link
        href={pendingHref}
        className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harvest-400"
      >
        <Card className="h-full transition-colors group-hover:border-harvest-300 group-hover:bg-harvest-50/40">
          {content}
        </Card>
      </Link>
    )
  }

  return <Card>{content}</Card>
}
