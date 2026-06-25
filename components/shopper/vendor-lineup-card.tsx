'use client'

import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import { CheckCircle } from 'lucide-react'
import { patronEventMapUrl } from '@/lib/shopper/public-floorplan-modes'
import type { VendorLineupEntry } from '@/lib/shopper/vendors'
import { getVendorLinks } from '@/lib/shopper/vendors'

interface VendorLineupCardProps {
  vendor: VendorLineupEntry
  eventId: string
  onClick: () => void
  onViewBoothOnMap?: (boothNumber: number) => void
}

export function VendorLineupCard({
  vendor,
  eventId,
  onClick,
  onViewBoothOnMap,
}: VendorLineupCardProps) {
  const passport = vendor.passport
  const displayName = vendor.displayName
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const links = getVendorLinks(passport)

  return (
    <Card
      className="cursor-pointer overflow-hidden transition hover:shadow-md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {passport?.item_image_urls && passport.item_image_urls.length > 0 && (
        <div className="flex h-20 gap-0.5 overflow-hidden">
          {passport.item_image_urls.slice(0, 3).map((url, i) => (
            <img key={i} src={url} alt="" className="h-full flex-1 object-cover" />
          ))}
        </div>
      )}
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <VendorLogo
            src={passport?.logo_url ?? vendor.vendor?.avatar_url}
            alt={`${displayName} logo`}
            fallback={initials}
            size="xs"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              {passport?.is_verified && (
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              )}
            </div>
            {vendor.category && (
              <Badge className="mt-0.5 text-[10px]" variant="outline">
                {vendor.category.name}
              </Badge>
            )}
            {vendor.booth_number != null ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-[10px] text-muted-foreground">Booth #{vendor.booth_number}</p>
                {onViewBoothOnMap ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-0.5 text-[10px] font-medium text-forest hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewBoothOnMap(vendor.booth_number!)
                    }}
                  >
                    <MapPin className="h-3 w-3" aria-hidden />
                    On map
                  </button>
                ) : (
                  <Link
                    href={patronEventMapUrl(eventId, vendor.booth_number)}
                    className="inline-flex items-center gap-0.5 text-[10px] font-medium text-forest hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MapPin className="h-3 w-3" aria-hidden />
                    Map
                  </Link>
                )}
              </div>
            ) : null}
            {links.length > 0 && (
              <p className="mt-1 text-[10px] text-forest">{links.map((l) => l.label).join(' · ')}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
