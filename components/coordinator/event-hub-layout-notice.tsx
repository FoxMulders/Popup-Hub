'use client'

import { useSearchParams } from 'next/navigation'
import { DesktopLayoutRequiredBanner } from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'

export function EventHubLayoutNotice() {
  const searchParams = useSearchParams()
  if (searchParams.get('layout') !== 'desktop-required') return null
  return <DesktopLayoutRequiredBanner className="mb-4" />
}
