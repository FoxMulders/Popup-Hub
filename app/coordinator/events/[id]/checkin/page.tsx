import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VendorCheckin } from '@/components/coordinator/vendor-checkin'
import { extractNestedPassport } from '@/lib/applications/extract-nested-passport'
import { MarketDayShell } from '@/components/coordinator/market-day-shell'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CheckinPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, coordinator_id')
    .eq('id', id)
    .eq('coordinator_id', user.id)
    .single()

  if (!event) notFound()

  const { data: applications } = await supabase
    .from('booth_applications')
    .select(`
      id,
      booth_number,
      checked_in,
      vendor:profiles!booth_applications_vendor_id_fkey(
        full_name,
        phone,
        passport:vendor_passports(business_name)
      ),
      category:categories(name)
    `)
    .eq('event_id', id)
    .eq('status', 'approved')
    .order('booth_number', { ascending: true, nullsFirst: false })

  const checkinApps = (applications ?? []).map((a) => ({
    id: a.id,
    booth_number: a.booth_number,
    checked_in: a.checked_in ?? false,
    vendor: Array.isArray(a.vendor) ? a.vendor[0] : a.vendor,
    passport: extractNestedPassport(a),
    category: Array.isArray(a.category) ? (a.category[0] ?? null) : a.category,
  }))

  return (
    <MarketDayShell eventId={id} eventName={event.name} activeSection="checkin">
      <div className="mx-auto max-w-2xl">
        <VendorCheckin eventId={id} applications={checkinApps} />
      </div>
    </MarketDayShell>
  )
}
