'use client'

import Link from 'next/link'
import { Monitor } from 'lucide-react'
import {
  floorPlanMobileAdvisoryBody,
  floorPlanRecommendedScreenLabel,
  FLOOR_PLAN_MOBILE_ADVISORY_TITLE,
} from '@/lib/floor-plan/viewport-advisory-copy'

export function LayoutDesktopRequiredBanner({ eventId }: { eventId: string }) {
  return (
    <div
      className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
      data-testid="layout-desktop-required-banner"
    >
      <div className="flex items-start gap-3">
        <Monitor className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">{FLOOR_PLAN_MOBILE_ADVISORY_TITLE}</p>
          <p>
            Use a screen larger than {floorPlanRecommendedScreenLabel()}.{' '}
            {floorPlanMobileAdvisoryBody()}
          </p>
          <Link
            href={`/coordinator/dashboard?event=${eventId}`}
            className="inline-flex font-medium text-amber-900 underline-offset-2 hover:underline"
          >
            Open Blueprint Studio on a desktop →
          </Link>
        </div>
      </div>
    </div>
  )
}
