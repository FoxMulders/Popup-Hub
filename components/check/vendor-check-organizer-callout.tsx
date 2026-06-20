import Link from 'next/link'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'
import { HubGuardLogo } from '@/components/brand/hubguard-logo'

export function VendorCheckOrganizerCallout() {
  return (
    <div className="mb-6 rounded-xl border border-harvest-200 bg-harvest-50/50 px-4 py-4 text-sm">
      <div className="flex items-start gap-3">
        <HubGuardLogo variant="icon" size="sm" className="mt-0.5 shrink-0" />
        <div className="space-y-2">
          <p className="font-medium text-foreground">
            {TRUST_DIRECTORY_LINKS.check.boothFeeHeadline}
          </p>
          <p className="text-muted-foreground">
            Search Edmonton-area organizers for scam alerts, vendor reviews, and community mentions.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              href={TRUST_DIRECTORY_LINKS.check.href}
              className="font-medium text-harvest-800 hover:underline underline-offset-2"
            >
              {TRUST_DIRECTORY_LINKS.check.label} →
            </Link>
            <Link
              href={TRUST_DIRECTORY_LINKS.review.href}
              className="text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
            >
              Leave a review →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
