import { Badge } from '@/components/ui/badge'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import type { VendorPassportApplicationPreview } from '@/lib/vendor/passport-application'
import { CheckCircle } from 'lucide-react'

interface PassportApplyPreviewProps {
  passport: VendorPassportApplicationPreview
}

export function PassportApplyPreview({ passport }: PassportApplyPreviewProps) {
  const initials = passport.business_name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="rounded-lg border bg-stone-50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Vendor Passport Preview
      </p>
      <div className="flex items-start gap-3">
        <VendorLogo
          src={passport.logo_url}
          alt={`${passport.business_name} logo`}
          fallback={initials}
          size="sm"
        />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-foreground">{passport.business_name}</p>
          {passport.is_verified ? (
            <Badge className="bg-blue-100 text-blue-700 text-[10px]">
              <CheckCircle className="mr-1 h-3 w-3" />
              Verified
            </Badge>
          ) : null}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Category</dt>
          <dd className="font-medium">{passport.category_name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tax ID</dt>
          <dd className="font-medium">{passport.tax_id_on_file ? 'On file' : 'Not provided'}</dd>
        </div>
      </dl>
    </div>
  )
}
