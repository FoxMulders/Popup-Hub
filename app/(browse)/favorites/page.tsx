import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EventCard } from '@/components/events/event-card'
import { FavoriteButton } from '@/components/shopper/favorite-button'
import { VendorFollowButton } from '@/components/shopper/vendor-follow-button'
import type { Event, Profile } from '@/types/database'
import { Heart, Store } from 'lucide-react'

export default async function FavoritesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirectTo=/favorites')

  const [{ data: favRows }, { data: followRows }] = await Promise.all([
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
  ])

  const events = (favRows ?? [])
    .map((f) => {
      const ev = Array.isArray(f.events) ? f.events[0] : f.events
      return ev as Event | null
    })
    .filter(Boolean) as Event[]

  events.sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  )

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Favorites</h1>
        <p className="mt-1 text-sm text-muted-foreground">Markets and vendors you&apos;re tracking</p>
      </div>

      <section>
        <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold">
          <Heart className="h-5 w-5 text-red-500" />
          Saved markets
        </h2>
        {events.length === 0 ? (
          <div className="rounded-2xl border bg-white py-12 text-center">
            <p className="text-muted-foreground">No saved markets yet.</p>
            <Link href="/discover" className="mt-4 inline-block text-sm font-semibold text-forest underline">
              Discover markets
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <div key={event.id} className="relative">
                <EventCard event={event} href={`/events/${event.id}`} />
                <div className="absolute right-3 top-40">
                  <FavoriteButton eventId={event.id} initialFavorited size="sm" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold">
          <Store className="h-5 w-5 text-forest" />
          Followed vendors
        </h2>
        {(followRows ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Follow vendors from a market&apos;s vendor lineup to track them here.
          </p>
        ) : (
          <ul className="space-y-2">
            {(followRows ?? []).map((row) => {
              const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
              const p = profile as Profile | null
              if (!p) return null
              return (
                <li
                  key={row.vendor_id}
                  className="flex items-center justify-between rounded-xl border bg-white px-4 py-3"
                >
                  <span className="font-medium">{p.full_name}</span>
                  <VendorFollowButton vendorId={row.vendor_id} initialFollowing />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
