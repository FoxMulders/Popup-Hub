import Link from 'next/link'
import { ShieldAlert, Search } from 'lucide-react'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { listPublishedOrganizers, searchPublishedOrganizers } from '@/lib/queries/organizers'
import { CheckSearchForm } from '@/components/check/check-search-form'
import { CheckOrganizerList } from '@/components/check/check-organizer-list'
import { HubGuardCoordinatorClaimCallout } from '@/components/check/hubguard-coordinator-claim-callout'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'

export const metadata = buildPublicMetadata({
  title: 'HubGuard — Popup Hub security & fraud prevention',
  description:
    'Search Edmonton-area market organizers. See official links, vendor discussions, and scam alerts before you send booth fees.',
  path: '/check',
})

type Props = {
  searchParams: Promise<{ q?: string; region?: string }>
}

export default async function CheckPage({ searchParams }: Props) {
  const { q = '', region = 'edmonton-metro' } = await searchParams
  const organizers =
    q.trim().length > 0
      ? await searchPublishedOrganizers(q, region)
      : await listPublishedOrganizers(region)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let canClaim = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .maybeSingle()
    canClaim = canActAsCoordinator(profile)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div className="space-y-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-harvest-700">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          {TRUST_DIRECTORY_LINKS.check.label} · {TRUST_DIRECTORY_LINKS.check.tagline}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {TRUST_DIRECTORY_LINKS.check.boothFeeHeadline}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Search Edmonton-area markets and organizers. Verify official websites before sending money.
          Scam alerts and community mentions appear only after admin verification.
        </p>
      </div>

      <CheckSearchForm initialQuery={q} region={region} />

      {canClaim ? <HubGuardCoordinatorClaimCallout /> : null}

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Search className="h-4 w-4" aria-hidden />
          {q.trim() ? `Results for “${q.trim()}”` : 'Organizers in our directory (Alberta today, expanding)'}
          <span className="text-muted-foreground font-normal">({organizers.length})</span>
        </h2>

        <CheckOrganizerList organizers={organizers} query={q} canClaim={canClaim} />
      </section>

      <div className="rounded-xl border border-harvest-200 bg-harvest-50/50 px-4 py-4 text-sm">
        <p className="font-medium text-foreground">Vended at a market recently?</p>
        <p className="mt-1 text-muted-foreground">
          Help other vendors through HubGuard before paying booth fees.
        </p>
        <Link
          href="/check/review"
          className="mt-3 inline-flex text-sm font-medium text-harvest-800 hover:underline underline-offset-2"
        >
          Leave a vendor review →
        </Link>
      </div>
    </div>
  )
}
