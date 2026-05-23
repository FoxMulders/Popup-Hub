'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CheckCircle } from 'lucide-react'
import type { VendorLineupEntry } from '@/lib/shopper/vendors'
import { getVendorLinks } from '@/lib/shopper/vendors'

interface VendorLineupCardProps {
  vendor: VendorLineupEntry
  onClick: () => void
}

export function VendorLineupCard({ vendor, onClick }: VendorLineupCardProps) {
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
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={passport?.logo_url ?? vendor.vendor?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-amber-100 text-xs font-bold text-amber-700">
              {initials}
            </AvatarFallback>
          </Avatar>
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
            {vendor.booth_number != null && (
              <p className="mt-1 text-[10px] text-muted-foreground">Booth #{vendor.booth_number}</p>
            )}
            {links.length > 0 && (
              <p className="mt-1 text-[10px] text-forest">{links.map((l) => l.label).join(' · ')}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
