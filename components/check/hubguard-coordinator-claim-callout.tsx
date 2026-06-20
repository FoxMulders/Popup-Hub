import Link from 'next/link'
import { HubGuardLogo } from '@/components/brand/hubguard-logo'

export function HubGuardCoordinatorClaimCallout() {
  return (
    <div className="rounded-xl border border-forest/20 bg-sage-50/80 px-4 py-4 text-sm">
      <p className="inline-flex items-center gap-2 font-semibold text-foreground">
        <HubGuardLogo variant="icon" size="sm" className="shrink-0" />
        Market organizer on Popup Hub?
      </p>
      <p className="mt-1 text-muted-foreground leading-relaxed">
        Claim your HubGuard profile to respond to vendor reviews, sync published markets, and show
        shoppers you operate this listing.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Find your organization below — unclaimed profiles show a{' '}
        <span className="font-medium text-foreground">Claim this profile</span> link on your trust
        report.
      </p>
      <Link
        href="/coordinator"
        className="mt-3 inline-flex text-sm font-medium text-forest hover:underline underline-offset-2"
      >
        Open coordinator home →
      </Link>
    </div>
  )
}
