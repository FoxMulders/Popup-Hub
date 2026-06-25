'use client'

import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import { Button } from '@/components/ui/button'
import { CheckCircle, MapPin, Globe, ShoppingBag, Camera } from 'lucide-react'
import { patronEventMapUrl } from '@/lib/shopper/public-floorplan-modes'
import { FacebookIcon } from '@/components/icons/facebook-icon'
import { TikTokIcon } from '@/components/icons/tiktok-icon'
import type { VendorLineupEntry } from '@/lib/shopper/vendors'
import { getVendorLinks } from '@/lib/shopper/vendors'
import { VendorFollowButton } from '@/components/shopper/vendor-follow-button'
import { PassportStoriesPublicStrip } from '@/components/passport/passport-stories-public-strip'

interface VendorSheetProps {
  vendor: VendorLineupEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  userId: string | null
  initialFollowing?: boolean
}

const LINK_ICONS = {
  website_url: Globe,
  shop_url: ShoppingBag,
  instagram_url: Camera,
  tiktok_url: TikTokIcon,
  facebook_url: FacebookIcon,
} as const

export function VendorSheet({
  vendor,
  open,
  onOpenChange,
  eventId,
  userId,
  initialFollowing = false,
}: VendorSheetProps) {
  if (!vendor) return null

  const passport = vendor.passport
  const displayName = vendor.displayName
  const links = getVendorLinks(passport)
  const mapHref =
    vendor.booth_number != null ? patronEventMapUrl(eventId, vendor.booth_number) : undefined
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">{displayName}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <PassportStoriesPublicStrip
            ownerId={vendor.vendor_id}
            displayName={displayName}
            avatarUrl={passport?.logo_url ?? vendor.vendor?.avatar_url ?? null}
          />

          <div className="flex items-start gap-3">
            <VendorLogo
              src={passport?.logo_url ?? vendor.vendor?.avatar_url}
              alt={`${displayName} logo`}
              fallback={initials}
              size="md"
            />
            <div>
              <div className="flex items-center gap-1">
                {passport?.is_verified && (
                  <CheckCircle className="h-4 w-4 text-blue-500" />
                )}
                {vendor.category && (
                  <Badge variant="outline">{vendor.category.name}</Badge>
                )}
              </div>
              {vendor.booth_number != null && (
                <p className="mt-1 text-sm text-muted-foreground">Booth #{vendor.booth_number}</p>
              )}
            </div>
          </div>

          {passport?.bio && (
            <p className="text-sm leading-relaxed text-muted-foreground">{passport.bio}</p>
          )}

          {passport?.item_image_urls && passport.item_image_urls.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {passport.item_image_urls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          )}

          {links.length > 0 && (
            <div className="space-y-2">
              {links.map((link) => {
                const Icon = LINK_ICONS[link.field] ?? Globe
                return (
                  <a
                    key={link.field}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 w-full items-center justify-start gap-2 rounded-lg border-2 border-stone-200 bg-card px-3 text-sm font-medium shadow-[var(--shadow-market)] hover:bg-canvas"
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </a>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {vendor.vendor_id && userId && (
              <VendorFollowButton
                vendorId={vendor.vendor_id}
                initialFollowing={initialFollowing}
              />
            )}
            {mapHref && vendor.booth_number != null && (
              <Link href={mapHref}>
                <Button variant="secondary" className="min-h-11 gap-1">
                  <MapPin className="h-4 w-4" />
                  Find on map
                </Button>
              </Link>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
