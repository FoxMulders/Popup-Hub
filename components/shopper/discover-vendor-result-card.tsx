'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import { VendorFollowButton } from '@/components/shopper/vendor-follow-button'
import { formatDistance } from '@/lib/shopper/geo'
import { buildVendorProfileHref } from '@/lib/shopper/vendors'
import type { DiscoverVendorHit } from '@/lib/shopper/discover-vendor-search'

interface DiscoverVendorResultCardProps {
  vendor: DiscoverVendorHit
  initialFollowing?: boolean
}

export function DiscoverVendorResultCard({
  vendor,
  initialFollowing = false,
}: DiscoverVendorResultCardProps) {
  const initials = vendor.businessName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <VendorLogo
              src={vendor.logoUrl}
              alt={`${vendor.businessName} logo`}
              fallback={initials}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{vendor.businessName}</p>
              {vendor.primaryCategoryName ? (
                <Badge className="mt-1 text-[10px]" variant="outline">
                  {vendor.primaryCategoryName}
                </Badge>
              ) : null}
            </div>
          </div>
          <VendorFollowButton vendorId={vendor.vendorId} initialFollowing={initialFollowing} />
        </div>

        <ul className="space-y-2 border-t border-stone-100 pt-3">
          {vendor.markets.map((market) => (
            <li key={`${vendor.vendorId}-${market.eventId}`} className="text-sm">
              <Link
                href={`/events/${market.eventId}`}
                className="font-medium text-forest hover:underline"
              >
                {market.eventName}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {format(new Date(market.startAt), 'EEE, MMM d, yyyy')}
                {market.city ? ` · ${market.city}` : ''}
                {market.distanceKm != null ? ` · ${formatDistance(market.distanceKm)}` : ''}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {market.boothNumber != null ? (
                  <span className="text-muted-foreground">Booth #{market.boothNumber}</span>
                ) : null}
                <Link
                  href={buildVendorProfileHref(market.eventId, vendor.vendorId)}
                  className="inline-flex items-center gap-0.5 font-medium text-forest hover:underline"
                >
                  <MapPin className="h-3 w-3" aria-hidden />
                  Vendor profile
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
