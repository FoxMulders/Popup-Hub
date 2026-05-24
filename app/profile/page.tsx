import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Profile } from '@/types/database'
import { FoundingVendorBadge } from '@/components/vendor/founding-vendor-badge'
import { ProfileForm } from './profile-form'
import { CoordinatorReliabilityBadge } from '@/components/coordinator/coordinator-reliability-badge'
import { PurchaseHistory } from '@/components/shopper/purchase-history'
import { VendorAccessStatus } from '@/components/shopper/vendor-access-status'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 xl:px-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900">Profile Settings</h1>
          <p className="mt-1.5 text-lg text-gray-500">Manage your account and notification preferences</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-10">
          <ProfileForm profile={profile as Profile} />

          {/* Sidebar info */}
          <aside className="space-y-6">
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="font-semibold text-gray-900 mb-3">SMS Notifications</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Add your phone number to receive SMS alerts for important events like auction wins,
                application approvals, and waitlist promotions.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
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

            <div className="rounded-2xl border bg-amber-50 border-amber-100 p-6">
              <h3 className="font-semibold text-amber-900 mb-2">Account Role</h3>
              <p className="text-sm text-amber-700 capitalize font-medium">{profile.role}</p>
              {profile.is_beta_tester ? (
                <div className="mt-3">
                  <FoundingVendorBadge />
                  <p className="text-xs text-amber-700 mt-2 leading-relaxed">
                    Early adopter perks are active — premium placement and priority queue bypass included.
                  </p>
                </div>
              ) : null}
              <p className="text-xs text-amber-600 mt-1.5">
                Contact support to change your account role.
              </p>
            </div>

            {profile.role === 'coordinator' && (
              <div className="rounded-2xl border bg-white p-6 space-y-3">
                <h3 className="font-semibold text-gray-900">Coordinator Accountability</h3>
                <CoordinatorReliabilityBadge
                  score={(profile as { reliability_score?: number }).reliability_score ?? 100}
                  recentLateCancellationAt={
                    (profile as { recent_late_cancellation_at?: string | null })
                      .recent_late_cancellation_at
                  }
                />
                <p className="text-xs text-gray-500 leading-relaxed">
                  Your public rating reflects on-time vs. late cancellations. Force majeure
                  cancellations do not reduce your score. Late non-emergency cancellations
                  (&lt;7 days notice) deduct more points and show a warning on your{' '}
                  <a href={`/coordinators/${profile.id}`} className="text-amber-700 underline">
                    public profile
                  </a>
                  .
                </p>
                <p className="text-xs text-gray-400">
                  Cancellations: {(profile as { coordinator_cancellation_count?: number }).coordinator_cancellation_count ?? 0}
                  {' · '}
                  Late: {(profile as { coordinator_late_cancellation_count?: number }).coordinator_late_cancellation_count ?? 0}
                </p>
              </div>
            )}

            <PurchaseHistory userId={profile.id} hidden />
            <VendorAccessStatus userId={profile.id} />
          </aside>
        </div>
    </div>
  )
}
