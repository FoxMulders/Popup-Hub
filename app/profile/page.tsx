import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/types/database'
import { FoundingVendorBadge } from '@/components/vendor/founding-vendor-badge'
import { ProfileForm } from './profile-form'
import { CoordinatorReliabilityBadge } from '@/components/coordinator/coordinator-reliability-badge'
import { CoordinatorCommunityTrustBanner } from '@/components/coordinator/coordinator-community-trust'
import { loadCoordinatorEscrowContext } from '@/lib/coordinator/escrow'
import { hasVerifiedBusinessTaxId } from '@/lib/coordinator/verification'
import { PurchaseHistory } from '@/components/shopper/purchase-history'
import { AccountAccessPanel } from '@/components/profile/account-access-panel'
import { AccountSecurityCard } from '@/components/profile/account-security-card'
import { NotificationPreferencesGrid } from '@/components/profile/notification-preferences-grid'
import { passportCompletionSummary, passportPathForProfile } from '@/lib/passport/requirements'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, IdCard } from 'lucide-react'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: passport }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('vendor_passports')
      .select('business_name, primary_category_id, category_ids')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!profile) redirect('/login')

  const completion = passportCompletionSummary(profile.role, passport, profile as Profile)

  const { count: ownedEventCount } =
    profile.role === 'coordinator'
      ? await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('coordinator_id', user.id)
      : { count: 0 }

  const escrowContext =
    profile.role === 'coordinator'
      ? await loadCoordinatorEscrowContext(supabase, user.id)
      : null

  const passportHref = passportPathForProfile(profile as Profile)

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 xl:px-16">
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Profile Settings</h1>
            <p className="mt-1.5 text-lg text-muted-foreground">Manage your account and notification preferences</p>
          </div>
          <Link href={passportHref}>
            <Button className=" gap-2">
              <IdCard className="h-4 w-4" />
              My Passport
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-10">
          <div className="space-y-6">
            <ProfileForm
              profile={profile as Profile}
              passportComplete={completion.complete}
            />
            <AccountSecurityCard email={profile.email} />
            <NotificationPreferencesGrid
              userId={profile.id}
              hasPhone={Boolean(profile.phone?.trim())}
            />
          </div>

          <aside className="space-y-6">
            <Link
              href={passportHref}
              className="block rounded-2xl border bg-white p-6 transition hover:border-harvest-200 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Popup Hub Passport</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {profile.role === 'vendor'
                      ? 'Your business identity for market applications and rosters.'
                      : profile.role === 'coordinator'
                        ? 'Your public identity when organizing markets.'
                        : 'Your identity for markets, auctions, and vendor contact.'}
                  </p>
                </div>
                <Badge
                  className={
                    completion.complete
                      ? 'bg-sage-100 text-sage-800 shrink-0'
                      : 'bg-harvest-100 text-harvest-700 shrink-0'
                  }
                >
                  {completion.complete ? 'Complete' : 'Incomplete'}
                </Badge>
              </div>
              {!completion.complete && completion.missing.length > 0 ? (
                <p className="mt-3 text-xs text-harvest-700">
                  Still needed: {completion.missing.join(', ')}
                </p>
              ) : null}
              <p className="mt-3 text-sm font-medium text-harvest-700">View passport →</p>
            </Link>
            <AccountAccessPanel
              email={profile.email}
              role={profile.role}
              isAdmin={profile.is_admin}
              ownedEventCount={ownedEventCount ?? 0}
            />

            {profile.is_beta_tester ? (
              <div className="rounded-2xl border bg-harvest-50 border-harvest-100 p-6">
                <h3 className="font-semibold text-harvest-800 mb-2">Early adopter</h3>
                <FoundingVendorBadge />
                <p className="text-xs text-harvest-700 mt-2 leading-relaxed">
                  Early adopter perks are active — premium placement and priority queue bypass included.
                </p>
              </div>
            ) : null}

            {profile.role === 'coordinator' && escrowContext ? (
              <CoordinatorCommunityTrustBanner
                escrowExempt={escrowContext.escrowExempt}
                hasVerifiedBusinessTaxId={hasVerifiedBusinessTaxId(profile as Profile)}
                vouchCount={escrowContext.vouchCount}
              />
            ) : null}

            {profile.role === 'coordinator' && (
              <div className="rounded-2xl border bg-white p-6 space-y-3">
                <h3 className="font-semibold text-foreground">Coordinator Accountability</h3>
                <CoordinatorReliabilityBadge
                  score={(profile as { reliability_score?: number }).reliability_score ?? 100}
                  recentLateCancellationAt={
                    (profile as { recent_late_cancellation_at?: string | null })
                      .recent_late_cancellation_at
                  }
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your public rating reflects on-time vs. late venue cancellations. Force majeure
                  cancellations do not reduce your score. Late non-emergency cancellations
                  (&lt;7 days notice) deduct more points and show a warning on your{' '}
                  <a href={`/coordinators/${profile.id}`} className="text-harvest-700 underline">
                    public profile
                  </a>
                  .
                </p>
                <p className="text-xs text-muted-foreground">
                  Cancellations: {(profile as { coordinator_cancellation_count?: number }).coordinator_cancellation_count ?? 0}
                  {' · '}
                  Late: {(profile as { coordinator_late_cancellation_count?: number }).coordinator_late_cancellation_count ?? 0}
                </p>
              </div>
            )}

            {profile.role === 'shopper' && (
              <div className="rounded-2xl border bg-white p-6 space-y-3">
                <h3 className="font-semibold text-foreground">Market Passport</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Vendors you scan at markets appear in your personal directory.
                </p>
                <Link
                  href="/profile/makers"
                  className="inline-flex text-sm font-medium text-harvest-700 hover:underline"
                >
                  Makers I Met →
                </Link>
                <p className="text-xs text-muted-foreground">
                  Public profile:{' '}
                  <a href={`/patrons/${profile.id}`} className="text-harvest-700 underline">
                    /patrons/{profile.id.slice(0, 8)}…
                  </a>
                </p>
              </div>
            )}

            <PurchaseHistory userId={profile.id} hidden />
          </aside>
        </div>
    </div>
  )
}
