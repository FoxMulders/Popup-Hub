'use client'

import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { Camera, ExternalLink, Globe, MapPin, ShoppingBag, Store } from 'lucide-react'
import { FacebookIcon } from '@/components/icons/facebook-icon'
import { TikTokIcon } from '@/components/icons/tiktok-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import { getVendorLinks, type VendorLink } from '@/lib/shopper/vendors'
import type { DiscoveredVendor } from '@/lib/market-night/summary'

const LINK_ICONS = {
  website_url: Globe,
  shop_url: ShoppingBag,
  instagram_url: Camera,
  tiktok_url: TikTokIcon,
  facebook_url: FacebookIcon,
} as const

interface DiscoveredVendorCardProps {
  vendor: DiscoveredVendor
}

export function DiscoveredVendorCard({ vendor }: DiscoveredVendorCardProps) {
  const links: VendorLink[] = getVendorLinks({
    website_url: vendor.websiteUrl,
    shop_url: vendor.shopUrl,
    instagram_url: vendor.instagramUrl,
    facebook_url: vendor.facebookUrl,
  })

  const initials = vendor.businessName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <article className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Link href={vendor.profileHref} className="shrink-0">
          <VendorLogo
            src={vendor.logoUrl}
            alt={`${vendor.businessName} logo`}
            fallback={initials}
            size="md"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={vendor.profileHref}
            className="font-semibold text-foreground hover:text-harvest-700 hover:underline"
          >
            {vendor.businessName}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {vendor.categoryName ? (
              <Badge variant="outline" className="text-[10px]">
                {vendor.categoryName}
              </Badge>
            ) : null}
            {vendor.boothNumber != null ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Booth #{vendor.boothNumber}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Passport scanned{' '}
            {formatDistanceToNow(new Date(vendor.scannedAt), { addSuffix: true })}
          </p>
          {vendor.bio ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{vendor.bio}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={vendor.profileHref}>
          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs">
            <Store className="h-3.5 w-3.5" />
            View profile
          </Button>
        </Link>
        {links.map((link) => {
          const Icon = LINK_ICONS[link.field] ?? ExternalLink
          return (
            <a
              key={link.field}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-stone-200 px-3 text-xs font-medium text-foreground hover:bg-canvas"
            >
              <Icon className="h-3.5 w-3.5" />
              {link.label}
            </a>
          )
        })}
      </div>
    </article>
  )
}

interface DiscoveredVendorsSectionProps {
  vendors: DiscoveredVendor[]
  eventId: string
}

export function DiscoveredVendorsSection({ vendors, eventId }: DiscoveredVendorsSectionProps) {
  if (vendors.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
        <Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" aria-hidden />
        <p className="font-medium text-foreground">No passport scans yet</p>
        <p className="mt-1 max-w-sm mx-auto text-sm text-muted-foreground">
          You checked out without scanning vendor passport QR codes at this market. Next time, scan
          booths you love to build your local maker directory automatically.
        </p>
        <Link href={`/events/${eventId}`} className="mt-4 inline-block">
          <Button size="sm" variant="outline">
            Browse vendor lineup
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {vendors.map((vendor) => (
        <DiscoveredVendorCard key={vendor.vendorId} vendor={vendor} />
      ))}
    </div>
  )
}
