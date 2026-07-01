import { createClient } from '@/lib/supabase/server'
import { PublicEventDetail } from '@/components/public/public-event-detail'
import { EventJsonLd } from '@/components/seo/event-json-ld'
import { JsonLdScript } from '@/components/seo/json-ld-script'
import { buildBreadcrumbJsonLd } from '@/lib/seo/breadcrumb-json-ld'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { resolveOrganizerSlugForCoordinator } from '@/lib/organizers/resolve-organizer-slug-for-coordinator'
import { format } from 'date-fns'

interface Props {
  params: Promise<{ id: string }>
}

type PublicEventMetadataRow = {
  name: string
  description: string | null
  location_name: string | null
  cover_image_url: string | null
  start_at: string | null
  city: string | null
  market_city: string | null
}

type PublicEventStructuredRow = {
  id: string
  name: string
  description: string | null
  start_at: string | null
  end_at: string | null
  location_name: string | null
  address: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  cover_image_url: string | null
  status: string | null
  coordinator_id: string | null
  market_city: string | null
  coordinator?: { id?: string; full_name?: string | null } | { id?: string; full_name?: string | null }[] | null
}

type PublicVendorApplicationRow = {
  passport?: { business_name?: string | null } | { business_name?: string | null }[] | null
}

type PublicQueryBuilder = PromiseLike<unknown> & {
  select: (columns: string, options?: unknown) => PublicQueryBuilder
  eq: (column: string, value: unknown) => PublicQueryBuilder
  in: (column: string, values: unknown[]) => PublicQueryBuilder
  maybeSingle: () => PublicQueryBuilder
  limit: (count: number) => PublicQueryBuilder
}

type UntypedSupabaseClient = {
  from: (table: string) => PublicQueryBuilder
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const publicDb = supabase as unknown as UntypedSupabaseClient
  const { data: event } = (await publicDb
    .from('events')
    .select('name, description, location_name, cover_image_url, start_at, city, market_city')
    .eq('id', id)
    .in('status', ['published', 'active', 'completed'])
    .maybeSingle()) as { data: PublicEventMetadataRow | null }

  if (!event) {
    return buildPublicMetadata({
      title: 'Market not found',
      description: 'This market listing is unavailable or has been removed.',
      path: `/events/${id}`,
    })
  }

  const dateLabel = event.start_at
    ? format(new Date(event.start_at), 'EEE, MMM d, yyyy')
    : null
  const description =
    event.description?.trim() ||
    `Pop-up market at ${event.location_name}${dateLabel ? ` on ${dateLabel}` : ''}. Browse confirmed vendors and plan your visit.`

  const cityLabel = event.city?.trim() || event.market_city?.trim()
  const keywords = [
    event.name,
    'popup market',
    'makers market',
    ...(cityLabel ? [`${cityLabel} markets`, `${cityLabel} popup market`] : []),
    ...(event.location_name ? [event.location_name] : []),
  ]

  const ogImage = event.cover_image_url?.trim() || `/events/${id}/opengraph-image`

  return buildPublicMetadata({
    title: event.name,
    description,
    path: `/events/${id}`,
    imageUrl: ogImage,
    type: 'article',
    keywords,
  })
}

export default async function PublicEventPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const publicDb = supabase as unknown as UntypedSupabaseClient

  const [{ data: event }, { count: vendorCount }, { data: vendorApps }] = await Promise.all([
    publicDb
      .from('events')
      .select(
        'id, name, description, start_at, end_at, location_name, address, city, market_city, latitude, longitude, cover_image_url, status, coordinator_id, coordinator:profiles!events_coordinator_id_fkey(id, full_name)'
      )
      .eq('id', id)
      .in('status', ['published', 'active', 'completed'])
      .maybeSingle(),
    publicDb
      .from('booth_applications')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'approved'),
    publicDb
      .from('booth_applications')
      .select('passport:vendor_passports(business_name)')
      .eq('event_id', id)
      .eq('status', 'approved')
      .limit(12),
  ]) as [
    { data: PublicEventStructuredRow | null },
    { count: number | null },
    { data: PublicVendorApplicationRow[] | null },
  ]

  const vendorNames = (vendorApps ?? [])
    .map((row) => {
      const passport = Array.isArray(row.passport) ? row.passport[0] : row.passport
      return (passport as { business_name?: string } | null | undefined)?.business_name?.trim()
    })
    .filter((name): name is string => Boolean(name))

  const coordinator = event
    ? Array.isArray(event.coordinator)
      ? event.coordinator[0]
      : event.coordinator
    : null

  const coordinatorId = coordinator?.id ?? event?.coordinator_id ?? null
  const organizerSlug =
    coordinatorId && event
      ? await resolveOrganizerSlugForCoordinator(supabase as never, coordinatorId)
      : null

  return (
    <>
      {event ? (
        <>
          <EventJsonLd
            event={event}
            vendorCount={vendorCount ?? 0}
            vendorNames={vendorNames}
            organizerId={coordinatorId}
            organizerSlug={organizerSlug}
          />
          <JsonLdScript
            data={buildBreadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Discover Markets', path: '/discover' },
              { name: event.name, path: `/events/${event.id}` },
            ])}
          />
        </>
      ) : null}
      <PublicEventDetail eventId={id} />
    </>
  )
}
