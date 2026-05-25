import { parseCheckinToken } from '@/lib/checkin-token'
import { createClient } from '@/lib/supabase/server'
import { VendorCheckinScan } from './vendor-checkin-scan'
import type { BoothLayout } from '@/types/database'
import { extractNestedPassport } from '@/lib/applications/extract-nested-passport'

interface Props {
  params: Promise<{ token: string }>
}

export default async function CheckinTokenPage({ params }: Props) {
  const { token } = await params
  const parsed = parseCheckinToken(token)

  if (!parsed) {
    return <InvalidTokenPage />
  }

  const { eventId, applicationId } = parsed
  const supabase = await createClient()

  const { data: application } = await supabase
    .from('booth_applications')
    .select(`
      id,
      checked_in,
      booth_number,
      vendor:profiles!booth_applications_vendor_id_fkey(
        full_name,
        passport:vendor_passports(business_name)
      ),
      category:categories(name),
      event:events(id, name, location_name, start_at)
    `)
    .eq('id', applicationId)
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .single()

  if (!application) {
    return <InvalidTokenPage />
  }

  const { data: layoutRow } = await supabase
    .from('booth_layouts')
    .select('id, event_id, venue_width, venue_length, booth_width, booth_length, entrance, spacing_mode, cells, venue_elements, created_at, updated_at')
    .eq('event_id', eventId)
    .maybeSingle()

  const vendor = Array.isArray(application.vendor) ? application.vendor[0] : application.vendor
  const passport = extractNestedPassport(application)
  const category = Array.isArray(application.category) ? (application.category[0] ?? null) : application.category
  const event = Array.isArray(application.event) ? application.event[0] : application.event

  if (!vendor || !event) {
    return <InvalidTokenPage />
  }

  return (
    <VendorCheckinScan
      application={{
        id: application.id,
        checked_in: application.checked_in ?? false,
        booth_number: application.booth_number,
        vendor: { full_name: vendor.full_name },
        passport: passport ? { business_name: passport.business_name } : null,
        category: category ? { name: category.name } : null,
        event: {
          id: event.id,
          name: event.name,
          location_name: event.location_name,
          start_at: event.start_at,
        },
      }}
      layout={(layoutRow as BoothLayout | null) ?? null}
    />
  )
}

function InvalidTokenPage() {
  return (
    <main className="market-page min-h-screen flex items-center justify-center px-4">
      <article className="max-w-sm w-full text-center space-y-4 py-16 market-panel p-8">
        <div className="mx-auto h-16 w-16 rounded-full bg-terracotta-50 border-2 border-terracotta-200 flex items-center justify-center">
          <span className="text-3xl" aria-hidden>❌</span>
        </div>
        <h1 className="font-heading text-xl font-semibold text-foreground">Invalid Check-In Link</h1>
        <p className="text-sm text-muted-foreground">
          This QR code is not valid or has expired. Please contact your event coordinator.
        </p>
      </article>
    </main>
  )
}
