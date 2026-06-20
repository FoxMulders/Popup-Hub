import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { MarketDayShell } from '@/components/coordinator/market-day-shell'
import {
  OperationsWorkspace,
  type OperationsApplication,
} from '@/components/coordinator/operations-workspace'
import type { BoothApplication, BoothCell, BoothClearancePolicy, Profile, VendorPassport } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

function normalizeApp(record: Record<string, unknown>): OperationsApplication {
  const base = record as unknown as BoothApplication
  const vendorRaw = Array.isArray(record.vendor) ? record.vendor[0] : record.vendor
  const vendor = vendorRaw as Profile & { passport?: VendorPassport | VendorPassport[] | null }
  const passportNested = vendor?.passport
  const passportTop = record.passport
  const passport = (Array.isArray(passportNested)
    ? passportNested[0] ?? null
    : passportNested ??
      (Array.isArray(passportTop) ? passportTop[0] ?? null : passportTop ?? null)) as VendorPassport | null

  return {
    ...base,
    vendor: vendorRaw as Profile,
    passport,
    category: (Array.isArray(record.category)
      ? record.category[0] ?? null
      : record.category ?? null) as { name: string } | null,
  }
}

export default async function OperationsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scope = await getCoordinatorScope(supabase, user.id)

  const { data: event } = await applyCoordinatorEventScope(
    supabase
      .from('events')
      .select('id, name, coordinator_id, booth_clearance_policy, status, raffle_donation_requirement')
      .eq('id', id),
    user.id,
    scope.isAdmin
  ).single()

  if (!event) notFound()
  if (event.status === 'cancelled') {
    redirect(`/coordinator/events/${id}`)
  }

  const { data: rawApplications } = await supabase
    .from('booth_applications')
    .select(`
      *,
      vendor:profiles!booth_applications_vendor_id_fkey(
        id, full_name, email, phone, avatar_url, role, created_at, is_beta_tester,
        reliability_score, total_markets, no_show_count, left_early_count,
        late_arrival_count, poor_cleanup_strike_count,
        passport:vendor_passports(id, user_id, business_name, bio, logo_url, item_image_urls, is_verified, created_at, primary_category_id, tax_id_encrypted)
      ),
      category:categories(name)
    `)
    .eq('event_id', id)
    .eq('status', 'approved')
    .order('booth_number', { ascending: true, nullsFirst: false })

  const applications = (rawApplications ?? []).map((application) =>
    normalizeApp(application as Record<string, unknown>)
  )

  const { data: layoutRow } = await supabase
    .from('booth_layouts')
    .select('cells')
    .eq('event_id', id)
    .maybeSingle()

  const boothCells = (layoutRow?.cells as BoothCell[] | null) ?? []

  return (
    <MarketDayShell eventId={id} eventName={event.name} activeSection="operations">
      <OperationsWorkspace
        eventId={id}
        eventName={event.name}
        applications={applications}
        boothCells={boothCells}
        raffleDonationRequirement={event.raffle_donation_requirement}
        boothClearancePolicy={(event.booth_clearance_policy as BoothClearancePolicy) ?? 'leave_furniture'}
      />
    </MarketDayShell>
  )
}
