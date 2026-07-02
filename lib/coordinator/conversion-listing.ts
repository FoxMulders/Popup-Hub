import type { AdCampaignStatus } from '@/types/database'

export const COORDINATOR_WELCOME_DISMISSED_COOKIE = 'coordinator_welcome_dismissed'

export function coordinatorCampaignHref(eventId: string): string {
  return `/coordinator/events/${encodeURIComponent(eventId)}/campaign`
}

export function isGenericCoordinatorLanding(path: string): boolean {
  return (
    path === '/coordinator' ||
    path === '/coordinator/markets' ||
    path === '/coordinator/welcome'
  )
}

export function adCampaignStatusLabel(status: AdCampaignStatus | string | null | undefined): string {
  switch (status) {
    case 'active':
      return 'Campaign active'
    case 'paused':
      return 'Campaign paused'
    case 'expired':
      return 'Campaign expired'
    case 'inactive':
    default:
      return 'No campaign'
  }
}

export function listingTierLabel(isExternalListing: boolean): string {
  return isExternalListing ? 'Ad listing' : 'Native market'
}

export function formatCampaignExpiry(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
