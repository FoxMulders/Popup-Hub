import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EventCard } from '@/components/events/event-card'
import { FavoriteButton } from '@/components/shopper/favorite-button'
import { VendorFollowButton } from '@/components/shopper/vendor-follow-button'
import { CoordinatorFollowButton } from '@/components/shopper/coordinator-follow-button'
import { SitePageBand } from '@/components/layout/site-page-band'
import { Button } from '@/components/ui/button'
import type { Event, Profile } from '@/types/database'
import { Heart, Store, Sparkles } from 'lucide-react'

export default async function FavoritesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <SitePageBand
          eyebrow="Patrons"
          title="Save markets you love"
          description="Browse markets without an account. Sign in only when you want to save favorites or follow vendors."
        />
        <div className="mx-auto max-w-lg px-4 py-12 text-center">
          <Heart className="mx-auto h-10 w-10 text-red-400" aria-hidden />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/discover">
              <Button variant="outline" size="pill" className="w-full sm:w-auto">
                Browse markets
              </Button>
            </Link>
            <Link href="/login?redirectTo=/favorites">
              <Button size="pill" className="w-full sm:w-auto">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </>
    )
  }

  const nowIso = new Date().toISOString()

  const [{ data: favRows }, { data: followRows }, { data: coordinatorFollowRows }] = await Promise.all([
    supabase
      .from('shopper_favorites')
      .select('event_id, events(*, event_days(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('vendor_follows')
      .select('vendor_id, profiles:vendor_id(id, full_name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('coordinator_follows')
      .select('coordinator_id, profiles:coordinator_id(id, full_name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const allEvents = (favRows ?? [])
    .map((f) => {
      const ev = Array.isArray(f.events) ? f.events[0] : f.events
      return ev as Event | null
    })
    .filter(Boolean) as Event[]

  const upcomingEvents = allEvents
    .filter((e) => new Date(e.end_at) >= new Date())
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  const pastCount = allEvents.length - upcomingEvents.length

  const followedCoordinatorIds = (coordinatorFollowRows ?? []).map((r) => r.coordinator_id)

  let coordinatorRecs: Event[] = []
  if (followedCoordinatorIds.length > 0) {
    const favoritedIds = new Set(upcomingEvents.map((e) => e.id))
    const { data: recRows } = await supabase
      .from('events')
      .select('*, event_days(*)')
      .in('coordinator_id', followedCoordinatorIds)
      .in('status', ['published', 'active'])
      .gte('end_at', nowIso)
      .order('start_at', { ascending: true })
      .limit(12)

    coordinatorRecs = (recRows ?? []).filter((e) => !favoritedIds.has(e.id)) as Event[]
  }

  const followedVendorIds = (followRows ?? []).map((r) => r.vendor_id)
  const vendorUpcoming: Array<{
    vendorId: string
    vendorName: string
    event: Event
  }> = []

  if (followedVendorIds.length > 0) {
    const { data: apps } = await supabase
      .from('booth_applications')
      .select('vendor_id, event:events(*, event_days(*))')
      .in('vendor_id', followedVendorIds)
      .eq('status', 'approved')

    const byVendor = new Map<string, Event[]>()
    for (const row of apps ?? []) {
      const ev = Array.isArray(row.event) ? row.event[0] : row.event
      if (!ev || new Date(ev.end_at) < new Date()) continue
      if (!['published', 'active'].includes(ev.status)) continue
      const list = byVendor.get(row.vendor_id) ?? []
      list.push(ev as Event)
      byVendor.set(row.vendor_id, list)
    }

    for (const row of followRows ?? []) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const p = profile as Profile | null
      if (!p) continue
      const events = (byVendor.get(row.vendor_id) ?? []).sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      )
      const next = events[0]
      if (next) {
        vendorUpcoming.push({
          vendorId: row.vendor_id,
          vendorName: p.full_name,
          event: next,
        })
      }
    }
  }

  return (
    <>
      <SitePageBand
        eyebrow="Patrons"
        title="Favorites"
        description="Markets and vendors you're tracking"
      />

      <div className="mx-auto max-w-full overflow-x-hidden px-4 py-8 sm:max-w-7xl">
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
            <Heart className="h-5 w-5 text-red-500" aria-hidden />
            Saved markets
          </h2>
          {upcomingEvents.length === 0 ? (
            <div className="marketing-glass-card py-12 text-center">
              <p className="text-muted-foreground">
                {pastCount > 0
                  ? "Your saved markets have ended. Discover what's coming up next."
                  : 'No saved markets yet.'}
              </p>
              <Link
                href="/discover"
                className="mt-4 inline-block text-sm font-semibold text-forest hover:underline"
              >
                Discover markets
              </Link>
            </div>
          ) : (
            <>
              {pastCount > 0 && (
                <p className="mb-3 text-xs text-muted-foreground">
                  {pastCount} past market{pastCount !== 1 ? 's' : ''} hidden from this list.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="relative">
                    <EventCard event={event} href={`/events/${event.id}`} />
                    <div className="absolute right-3 top-3 z-10">
                      <FavoriteButton
                        eventId={event.id}
                        initialFavorited
                        size="sm"
                        iconOnly
                        className="h-9 w-9 rounded-full bg-white/95 p-0 shadow-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {coordinatorRecs.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
              <Sparkles className="h-5 w-5 text-harvest-600" aria-hidden />
              New from organizers you follow
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coordinatorRecs.slice(0, 6).map((event) => (
                <EventCard key={event.id} event={event} href={`/events/${event.id}`} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
            <Sparkles className="h-5 w-5 text-harvest-600" aria-hidden />
            Organizers you follow
          </h2>
          {(coordinatorFollowRows ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Follow an organizer from a market page to get notified when they publish new dates.
            </p>
          ) : (
            <ul className="space-y-3">
              {(coordinatorFollowRows ?? []).map((row) => {
                const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
                const p = profile as Profile | null
                if (!p) return null
                return (
                  <li key={row.coordinator_id} className="marketing-glass-card px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link
                        href={`/coordinators/${row.coordinator_id}`}
                        className="font-medium text-forest hover:underline"
                      >
                        {p.full_name}
                      </Link>
                      <CoordinatorFollowButton
                        coordinatorId={row.coordinator_id}
                        coordinatorName={p.full_name}
                        initialFollowing
                        size="sm"
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
            <Store className="h-5 w-5 text-forest" aria-hidden />
            Followed vendors
          </h2>
          {(followRows ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Follow vendors from a market&apos;s vendor lineup to track them here.
            </p>
          ) : (
            <ul className="space-y-3">
              {(followRows ?? []).map((row) => {
                const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
                const p = profile as Profile | null
                if (!p) return null
                const upcoming = vendorUpcoming.find((v) => v.vendorId === row.vendor_id)
                return (
                  <li key={row.vendor_id} className="marketing-glass-card space-y-2 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{p.full_name}</span>
                      <VendorFollowButton vendorId={row.vendor_id} initialFollowing />
                    </div>
                    {upcoming ? (
                      <Link
                        href={`/events/${upcoming.event.id}`}
                        className="block text-sm text-forest hover:underline"
                      >
                        Next market: {upcoming.event.name} ·{' '}
                        {new Date(upcoming.event.start_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Link>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No upcoming approved markets yet.
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
