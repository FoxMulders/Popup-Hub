import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EventDetailClient } from '@/components/shopper/event-detail-client'
import { getStrollerBadge } from '@/lib/shopper/layout'
import { getVendorAccessRequest } from '@/lib/vendor/access'
import { summarizeEventAuctions } from '@/lib/auction/event-auctions'
import { QuarterAuctionEventBanner } from '@/components/quarter-auction/event-banner'
import type {
  Auction,
  BoothApplication,
  BoothLayout,
  Event,
  EventScheduleItem,
  Role,
  VendorProduct,
} from '@/types/database'

interface PublicEventDetailProps {
  eventId: string
}

export async function PublicEventDetail({ eventId }: PublicEventDetailProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: event } = await supabase
    .from('events')
    .select(`
      *,
      coordinator:profiles!events_coordinator_id_fkey(
        id, full_name, avatar_url,
        reliability_score, recent_late_cancellation_at
      ),
      category_limits:event_category_limits(*, category:categories(name)),
      event_days(*)
    `)
    .eq('id', eventId)
    .in('status', ['published', 'active', 'completed'])
    .single()

  if (!event) notFound()

  const [
    { data: applications },
    { data: layoutRow },
    { data: scheduleItems },
    { data: eventAuctions },
    favResult,
    remindersResult,
    followsResult,
    reviewResult,
  ] = await Promise.all([
    supabase
      .from('booth_applications')
      .select(`
        *,
        vendor:profiles(id, full_name, avatar_url),
        passport:vendor_passports(
          business_name, bio, logo_url, item_image_urls, is_verified,
          website_url, shop_url, instagram_url
        ),
        category:categories(id, name)
      `)
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .order('approved_at', { ascending: true }),
    supabase.from('booth_layouts').select('*').eq('event_id', eventId).maybeSingle(),
    supabase
      .from('event_schedule_items')
      .select('*')
      .eq('event_id', eventId)
      .order('starts_at', { ascending: true }),
    supabase
      .from('auctions')
      .select('*')
      .eq('event_id', eventId)
      .in('status', ['upcoming', 'active', 'ended'])
      .order('created_at', { ascending: false }),
    user
      ? supabase
          .from('shopper_favorites')
          .select('event_id')
          .eq('user_id', user.id)
          .eq('event_id', eventId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from('event_reminders')
          .select('reminder_offset')
          .eq('user_id', user.id)
          .eq('event_id', eventId)
      : Promise.resolve({ data: [] }),
    user
      ? supabase.from('vendor_follows').select('vendor_id').eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
    user
      ? supabase
          .from('event_reviews')
          .select('rating')
          .eq('user_id', user.id)
          .eq('event_id', eventId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const vendorIds = (applications ?? []).map((a) => a.vendor_id)
  let products: (VendorProduct & { vendor_name?: string; vendor_id: string })[] = []

  if (vendorIds.length > 0) {
    const { data: productRows } = await supabase
      .from('vendor_products')
      .select('*')
      .in('vendor_id', vendorIds)
      .eq('is_featured', true)
      .limit(24)

    const nameByVendor = new Map<string, string>()
    for (const app of applications ?? []) {
      const passport = Array.isArray(app.passport) ? app.passport[0] : app.passport
      nameByVendor.set(
        app.vendor_id,
        passport?.business_name ?? app.vendor?.full_name ?? 'Vendor'
      )
    }

    products = (productRows ?? []).map((p) => ({
      ...(p as VendorProduct),
      vendor_id: p.vendor_id,
      vendor_name: nameByVendor.get(p.vendor_id),
    }))
  }

  const layout = layoutRow as BoothLayout | null
  const strollerBadge = getStrollerBadge(layout)
  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator

  let userRole: Role | null = null
  let vendorAccessRequest = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    userRole = (profile?.role as Role | undefined) ?? 'shopper'
    if (userRole === 'vendor' && coordinator?.id) {
      vendorAccessRequest = await getVendorAccessRequest(supabase, user.id, coordinator.id)
    }
  }

  const auctionSummary = summarizeEventAuctions((eventAuctions ?? []) as Auction[])

  return (
    <EventDetailClient
      event={event as Event}
      applications={(applications ?? []) as BoothApplication[]}
      layout={layout}
      strollerBadge={strollerBadge}
      favorited={!!favResult.data}
      userId={user?.id ?? null}
      reminderOffsets={(remindersResult.data ?? []).map(
        (r: { reminder_offset: string }) => r.reminder_offset
      )}
      followVendorIds={(followsResult.data ?? []).map((f: { vendor_id: string }) => f.vendor_id)}
      products={products}
      scheduleItems={(scheduleItems ?? []) as EventScheduleItem[]}
      activeAuction={auctionSummary.active}
      upcomingAuction={auctionSummary.upcoming}
      lastEndedAuction={auctionSummary.lastEnded}
      existingReviewRating={reviewResult.data?.rating ?? null}
      coordinatorId={coordinator?.id ?? null}
      coordinatorName={coordinator?.full_name ?? 'Organizer'}
      vendorAccessRequest={vendorAccessRequest}
      userRole={userRole}
      quarterAuctionBanner={<QuarterAuctionEventBanner eventId={eventId} />}
    />
  )
}
