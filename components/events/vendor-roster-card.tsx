import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import type { BoothApplication } from '@/types/database'
import { CheckCircle } from 'lucide-react'

interface VendorRosterCardProps {
  application: BoothApplication
}

export function VendorRosterCard({ application }: VendorRosterCardProps) {
  const passport = application.passport
  const vendor = application.vendor
  const category = application.category

  const displayName = passport?.business_name ?? vendor?.full_name ?? 'Vendor'
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Card className="overflow-hidden transition hover:shadow-md">
      {/* Photo strip */}
      {passport?.item_image_urls && passport.item_image_urls.length > 0 && (
        <div className="flex h-24 gap-0.5 overflow-hidden">
          {passport.item_image_urls.slice(0, 3).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="h-full flex-1 object-cover"
            />
          ))}
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <VendorLogo
            src={passport?.logo_url ?? vendor?.avatar_url}
            alt={`${displayName} logo`}
            fallback={initials}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate font-semibold text-foreground text-sm">{displayName}</p>
              {passport?.is_verified && (
                <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
              )}
            </div>
            {category && (
              <Badge className="mt-0.5 bg-harvest-50 text-harvest-700 text-[10px] hover:bg-harvest-50">
                {category.name}
              </Badge>
            )}
            {passport?.bio && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{passport.bio}</p>
            )}
          </div>
        </div>
        {application.booth_number && (
          <p className="mt-2 text-right text-xs text-muted-foreground">Booth #{application.booth_number}</p>
        )}
      </CardContent>
    </Card>
  )
}
