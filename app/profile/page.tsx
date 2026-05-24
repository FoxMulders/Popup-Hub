import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/types/database'
import { FoundingVendorBadge } from '@/components/vendor/founding-vendor-badge'
import { ProfileForm } from './profile-form'
import { CoordinatorReliabilityBadge } from '@/components/coordinator/coordinator-reliability-badge'
import { PurchaseHistory } from '@/components/shopper/purchase-history'
import { AccountAccessPanel } from '@/components/profile/account-access-panel'
import { PASSPORT_PATH, passportCompletionSummary } from '@/lib/passport/requirements'
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

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 xl:px-16">
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Profile Settings</h1>
            <p className="mt-1.5 text-lg text-muted-foreground">Manage your account and notification preferences</p>
          </div>
          <Link href={PASSPORT_PATH}>
            <Button className=" gap-2">
              <IdCard className="h-4 w-4" />
              My Passport
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-10">
          <ProfileForm profile={profile as Profile} passportComplete={completion.complete} />

          {/* Sidebar info */}
          <aside className="space-y-6">
            <Link
              href={PASSPORT_PATH}
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
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="font-semibold text-foreground mb-3">SMS Notifications</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Add your phone number to receive SMS alerts for important events like auction wins,
                application approvals, and waitlist promotions.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-harvest-400" />
                  Auction win notifications
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Application approval alerts
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  Waitlist promotion alerts
                </li>
              </ul>
            </div>

            <AccountAccessPanel
              email={profile.email}
              role={profile.role}
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
                  Your public rating reflects on-time vs. late cancellations. Force majeure
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

            <PurchaseHistory userId={profile.id} hidden />
          </aside>
        </div>
    </div>
  )
}
