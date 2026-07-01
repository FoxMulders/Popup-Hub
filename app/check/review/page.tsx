import Link from 'next/link'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { canActAsVendor } from '@/lib/auth/rbac'
import { listPublishedOrganizers } from '@/lib/queries/organizers'
import { createClient } from '@/lib/supabase/server'
import { OrganizerReviewForm } from '@/components/check/organizer-review-form'
import { HubGuardLogo } from '@/components/brand/hubguard-logo'
import type { Profile } from '@/types/database'

export const metadata = buildPublicMetadata({
  title: 'Review an organizer',
  description:
    'Share your experience vending at a market. Help other vendors through HubGuard before paying booth fees.',
  path: '/check/review',
})

type Props = {
  searchParams: Promise<{ organizer?: string; event?: string; month?: string }>
}

export default async function CheckReviewPage({ searchParams }: Props) {
  const { organizer: organizerSlug, event: initialEventName, month: initialEventMonthYear } =
    await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: Pick<Profile, 'role' | 'is_admin'> | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .maybeSingle()
    profile = data
  }

  const organizers = await listPublishedOrganizers()
  const returnPath = organizerSlug
    ? `/check/review?organizer=${encodeURIComponent(organizerSlug)}`
    : '/check/review'

  return (
    <div className="mx-auto max-w-xl px-4 py-10 space-y-6">
      <div className="space-y-3">
        <Link
          href="/check"
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          ← Back to organizer search
        </Link>
        <HubGuardLogo variant="lockup" size="sm" />
        <h1 className="text-2xl font-bold tracking-tight">Review an organizer</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Vended at a market in the last year or two? Leave a structured review — about 90 seconds.
          Your review is shared with the organizer (they can add their perspective) and helps other
          vendors before they send booth fees. One review per event month. If the organizer is not in
          our list yet, choose &ldquo;Organizer not listed&rdquo; — we verify new names before they
          appear in search.
        </p>
      </div>

      <OrganizerReviewForm
        organizers={organizers}
        initialOrganizerSlug={organizerSlug}
        initialEventName={initialEventName}
        initialEventMonthYear={initialEventMonthYear}
        canSubmit={canActAsVendor(profile)}
        isSignedIn={Boolean(user)}
        returnPath={returnPath}
      />
    </div>
  )
}
