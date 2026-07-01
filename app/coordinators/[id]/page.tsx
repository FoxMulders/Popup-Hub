import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { excludeTestMarkets } from '@/lib/queries/public-market-catalog'
import { resolveProfileAvatarForServer } from '@/lib/profile/server-avatar'
import { loadPublicPassportIndex } from '@/lib/passport/public-passport-index'
import { PassportPublicCard } from '@/components/passport/passport-public-card'
import { PassportStoriesPublicStrip } from '@/components/passport/passport-stories-public-strip'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { Badge } from '@/components/ui/badge'
import { CoordinatorReliabilityBadge } from '@/components/coordinator/coordinator-reliability-badge'
import { CoordinatorPeerVouchButton } from '@/components/coordinator/coordinator-community-trust'
import { CoordinatorFollowButton } from '@/components/shopper/coordinator-follow-button'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { format } from 'date-fns'
import { Calendar, MapPin, ArrowLeft } from 'lucide-react'
import type { Event } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', id)
    .eq('role', 'coordinator')
    .maybeSingle()

  if (!profile) {
    return buildPublicMetadata({
      title: 'Organizer not found',
      description: 'This market organizer profile is unavailable.',
      path: `/coordinators/${id}`,
    })
  }

  return buildPublicMetadata({
    title: `${profile.full_name} — Market Organizer`,
    description: `Browse upcoming and past popup markets organized by ${profile.full_name} on Popup Hub.`,
    path: `/coordinators/${id}`,
    imageUrl: profile.avatar_url,
  })
}

export default async function CoordinatorPublicProfilePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const service = await createServiceClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id, full_name, avatar_url, role, created_at,
      reliability_score,
      coordinator_cancellation_count,
      coordinator_late_cancellation_count,
      recent_late_cancellation_at,
      coordinator_is_verified
    `)
    .eq('id', id)
    .eq('role', 'coordinator')
    .single()

  if (!profile) notFound()

  let canPeerVouch = false
  let alreadyPeerVouched = false
  let followingCoordinator = false

  if (user && user.id !== id) {
    const { data: viewer } = await supabase
      .from('profiles')
      .select('role, is_admin, coordinator_is_verified')
      .eq('id', user.id)
      .maybeSingle()

    if (viewer && canActAsCoordinator(viewer) && viewer.coordinator_is_verified === true) {
      canPeerVouch = true
      const { data: existingVouch } = await supabase
        .from('coordinator_peer_vouches')
        .select('id')
        .eq('coordinator_id', id)
        .eq('voucher_id', user.id)
        .maybeSingle()
      alreadyPeerVouched = !!existingVouch
    }

    const { data: followRow } = await supabase
      .from('coordinator_follows')
      .select('coordinator_id')
      .eq('user_id', user.id)
      .eq('coordinator_id', id)
      .maybeSingle()
    followingCoordinator = !!followRow
  }

  const [displayAvatarUrl, publicPassport] = await Promise.all([
    resolveProfileAvatarForServer(supabase, profile),
    loadPublicPassportIndex(service, id),
  ])

  const displayName = publicPassport?.businessName?.trim() || profile.full_name

  const { data: events } = await excludeTestMarkets(
    supabase
      .from('events')
      .select('id, name, location_name, start_at, status')
      .eq('coordinator_id', id)
      .in('status', ['published', 'active', 'completed'])
  )
    .order('start_at', { ascending: false })
    .limit(12)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <PassportPublicCard
        displayName={displayName}
        avatarUrl={displayAvatarUrl}
        passport={publicPassport}
        subtitle={`Market Organizer · Member since ${format(new Date(profile.created_at), 'MMMM yyyy')}`}
        headingLevel="h1"
      >
        <PassportStoriesPublicStrip
          ownerId={profile.id}
          displayName={displayName}
          avatarUrl={displayAvatarUrl}
        />
      </PassportPublicCard>

      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <CoordinatorReliabilityBadge
          score={profile.reliability_score as number}
          recentLateCancellationAt={profile.recent_late_cancellation_at as string | null}
        />

        {profile.coordinator_is_verified ? (
          <Badge className="bg-sage-100 text-sage-800">Community verified organizer</Badge>
        ) : null}

        {canPeerVouch ? (
          <CoordinatorPeerVouchButton
            coordinatorId={profile.id}
            coordinatorName={displayName}
            canVouch
            alreadyVouched={alreadyPeerVouched}
          />
        ) : null}

        {user && user.id !== id ? (
          <CoordinatorFollowButton
            coordinatorId={profile.id}
            coordinatorName={displayName}
            initialFollowing={followingCoordinator}
          />
        ) : null}

        <div className="grid grid-cols-2 gap-3 pt-2 text-center text-sm">
          <div className="rounded-xl border bg-canvas p-3">
            <p className="text-xl font-bold text-foreground">{(events ?? []).length}</p>
            <p className="text-xs text-muted-foreground">Active & past markets</p>
          </div>
          <div className="rounded-xl border bg-canvas p-3">
            <p className="text-xl font-bold text-foreground">
              {profile.coordinator_cancellation_count as number}
            </p>
            <p className="text-xs text-muted-foreground">Total cancellations</p>
          </div>
        </div>

        {(profile.coordinator_late_cancellation_count as number) > 0 && (
          <p className="text-xs text-muted-foreground">
            {profile.coordinator_late_cancellation_count as number} cancellation
            {(profile.coordinator_late_cancellation_count as number) === 1 ? '' : 's'} occurred
            with less than 7 days notice (non-emergency).
          </p>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Markets</h2>
        {!events || events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public markets listed yet.</p>
        ) : (
          <ul className="space-y-2">
            {(events as Pick<Event, 'id' | 'name' | 'location_name' | 'start_at' | 'status'>[]).map(
              (ev) => (
                <li key={ev.id}>
                  <Link
                    href={`/events/${ev.id}`}
                    className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 hover:bg-harvest-50/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{ev.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {ev.location_name}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(ev.start_at), 'MMM d, yyyy')}
                      </p>
                      <Badge variant="outline" className="text-[10px] mt-1 capitalize">
                        {ev.status}
                      </Badge>
                    </div>
                  </Link>
                </li>
              )
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
