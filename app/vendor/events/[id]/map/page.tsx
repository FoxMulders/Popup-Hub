import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PublicFloorplan } from '@/components/shopper/public-floorplan'
import { layoutHasDrawableGeometry } from '@/lib/booth-planner/layout-rooms'
import {
  resolveVendorBoothHighlightFromLayout,
  vendorDisplayNamesForLayoutMatch,
} from '@/lib/shopper/resolve-vendor-booth-from-layout'
import { ArrowLeft, MapPin } from 'lucide-react'
import type { BoothLayout } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

const VENDOR_MAP_STATUSES = ['approved', 'pending_insurance'] as const

export default async function VendorEventMapPage({ params }: Props) {
  const { id: eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(`/vendor/events/${eventId}/map`)}`)
  }

  const [{ data: application }, { data: event }, { data: layoutRow }, { data: passport }, { data: profile }] =
    await Promise.all([
    supabase
      .from('booth_applications')
      .select('id, status, booth_number')
      .eq('event_id', eventId)
      .eq('vendor_id', user.id)
      .in('status', [...VENDOR_MAP_STATUSES])
      .maybeSingle(),
    supabase.from('events').select('id, name, location_name').eq('id', eventId).maybeSingle(),
    supabase.from('booth_layouts').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('vendor_passports').select('business_name').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])

  if (!application || !event) notFound()

  const layout = (layoutRow as BoothLayout | null) ?? null
  const hasGeometry = layoutHasDrawableGeometry(layout)
  const boothNumber =
    layout != null
      ? resolveVendorBoothHighlightFromLayout(layout, {
          vendorUserId: user.id,
          applicationBoothNumber: application.booth_number,
          vendorDisplayNames: vendorDisplayNamesForLayoutMatch(passport, profile),
        })
      : application.booth_number

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 pb-28">
      <Link
        href={`/vendor/events/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {event.name}
      </Link>

      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold">
          {boothNumber != null ? 'Your booth on the floor plan' : 'Venue preview'}
        </h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          {event.location_name}
        </p>
      </div>

      {boothNumber == null ? (
        <p className="rounded-xl border border-dashed bg-canvas px-4 py-3 text-sm text-muted-foreground">
          Your exact booth isn&apos;t assigned yet. This preview shows the market layout — check back
          after the organizer places you on HubGrid.
        </p>
      ) : (
        <p className="rounded-xl border border-forest/30 bg-forest/5 px-4 py-3 text-sm text-foreground">
          Booth <strong>#{boothNumber}</strong> is highlighted below. Use the route overlay to walk
          from the entrance to your spot for load-in.
        </p>
      )}

      {!hasGeometry || !layout ? (
        <p className="rounded-xl border border-dashed bg-canvas px-4 py-6 text-sm text-muted-foreground">
          The organizer has not published a floor plan for this market yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white p-3 sm:p-4">
          <PublicFloorplan
            layout={layout}
            highlightBoothNumber={boothNumber}
            mode="vendor-setup"
            showRouteModePicker={false}
            showGuestTables={false}
          />
        </div>
      )}
    </div>
  )
}
