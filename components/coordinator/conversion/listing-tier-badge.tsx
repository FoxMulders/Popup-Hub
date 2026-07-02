import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  adCampaignStatusLabel,
  listingTierLabel,
} from '@/lib/coordinator/conversion-listing'
import type { AdCampaignStatus } from '@/types/database'

export interface ListingTierBadgeProps {
  isExternalListing: boolean
  adCampaignStatus?: AdCampaignStatus | string | null
  className?: string
}

export function ListingTierBadge({
  isExternalListing,
  adCampaignStatus,
  className,
}: ListingTierBadgeProps) {
  if (isExternalListing) {
    const campaignActive = adCampaignStatus === 'active'
    return (
      <Badge
        variant="secondary"
        className={cn(
          'h-5 px-1.5 text-[10px] font-medium',
          campaignActive
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-stone-300 bg-stone-100 text-stone-700',
          className
        )}
      >
        {listingTierLabel(true)}
        {adCampaignStatus && adCampaignStatus !== 'inactive'
          ? ` · ${adCampaignStatusLabel(adCampaignStatus)}`
          : null}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn('h-5 border-forest/30 bg-forest/5 px-1.5 text-[10px] font-medium text-forest', className)}
    >
      {listingTierLabel(false)}
    </Badge>
  )
}
