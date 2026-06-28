import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

export type WorkflowFixtures = {
  draftEventId: string
  draftEventName: string
  categoryId: string
  categoryName: string
  coordinatorId: string
  vendorId: string
}

const FIXTURES_PATH = path.join(process.cwd(), 'tests/e2e/workflow/.fixtures.json')

export function workflowFixturesPath(): string {
  return FIXTURES_PATH
}

export function writeWorkflowFixtures(fixtures: WorkflowFixtures): void {
  const dir = path.dirname(FIXTURES_PATH)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(FIXTURES_PATH, JSON.stringify(fixtures, null, 2))
}

export function readWorkflowFixtures(): WorkflowFixtures | null {
  try {
    return JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8')) as WorkflowFixtures
  } catch {
    return null
  }
}

function futureSchedule(): { startAt: string; endAt: string; startDate: string; endDate: string } {
  const start = new Date()
  start.setDate(start.getDate() + 30)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setHours(16, 0, 0, 0)
  const isoDate = (d: Date) => d.toISOString().slice(0, 10)
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    startDate: isoDate(start),
    endDate: isoDate(end),
  }
}

export async function seedVendorPassport(
  supabase: SupabaseClient,
  vendorId: string
): Promise<{ categoryId: string; categoryName: string }> {
  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_broad', true)
    .neq('name', 'Alcohol')
    .order('name')
    .limit(1)
    .maybeSingle()

  if (categoryError || !category) {
    throw new Error(
      categoryError?.message ?? 'No broad category found — apply migrations before seeding passport'
    )
  }

  const { error } = await supabase.from('vendor_passports').upsert(
    {
      user_id: vendorId,
      business_name: 'QA Test Vendor Co.',
      primary_category_id: category.id,
      category_ids: [category.id],
      bio: 'Seeded vendor passport for workflow QA.',
      logo_url: null,
      item_image_urls: [],
      is_verified: false,
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    throw new Error(`vendor passport: ${error.message}`)
  }

  return { categoryId: category.id, categoryName: category.name }
}

export async function seedWorkflowDraftEvent(
  supabase: SupabaseClient,
  coordinatorId: string,
  categoryId: string,
  vendorId: string
): Promise<{ eventId: string; eventName: string }> {
  const schedule = futureSchedule()
  const eventName = `QA Workflow ${schedule.startDate}`

  const { data: existing } = await supabase
    .from('events')
    .select('id, name, status')
    .eq('coordinator_id', coordinatorId)
    .eq('name', eventName)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    await supabase.from('event_category_limits').delete().eq('event_id', existing.id)
    await supabase.from('booth_layouts').delete().eq('event_id', existing.id)
  }

  const eventPayload = {
    coordinator_id: coordinatorId,
    name: eventName,
    description: 'Seeded draft market for full workflow QA automation.',
    location_name: 'QA Community Hall',
    address: '100 QA Test Ave, Edmonton, AB',
    latitude: 53.5461,
    longitude: -113.4938,
    start_at: schedule.startAt,
    end_at: schedule.endAt,
    booking_mode: 'juried' as const,
    listing_type: 'community_market' as const,
    status: 'draft' as const,
    allow_mlm: true,
    require_full_attendance: true,
    skip_venue_layout: true,
    is_test: true,
    market_city: 'edmonton',
    booth_clearance_policy: 'leave_furniture' as const,
    booth_price_cents: 0,
  }

  let eventId = existing?.id

  if (eventId) {
    const { error } = await supabase.from('events').update(eventPayload).eq('id', eventId)
    if (error) throw new Error(`update draft event: ${error.message}`)
  } else {
    const { data, error } = await supabase.from('events').insert(eventPayload).select('id').single()
    if (error || !data) throw new Error(error?.message ?? 'insert draft event failed')
    eventId = data.id
  }

  const { error: limitError } = await supabase.from('event_category_limits').insert({
    event_id: eventId,
    category_id: categoryId,
    max_slots: 10,
    price_per_booth: 0,
  })
  if (limitError) throw new Error(`category limit: ${limitError.message}`)

  const { error: layoutError } = await supabase.from('booth_layouts').upsert(
    {
      event_id: eventId,
      venue_width: 50,
      venue_length: 50,
      booth_width: 10,
      booth_length: 10,
      entrance: 'south',
      cells: [],
      layout_rooms: [],
    },
    { onConflict: 'event_id' }
  )
  if (layoutError) throw new Error(`booth layout: ${layoutError.message}`)

  await supabase
    .from('booth_applications')
    .delete()
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)

  const { error: publishError } = await supabase
    .from('events')
    .update({ status: 'published' })
    .eq('id', eventId)

  if (publishError) throw new Error(`publish event: ${publishError.message}`)

  const { error: applicationError } = await supabase.from('booth_applications').insert({
    event_id: eventId,
    vendor_id: vendorId,
    category_id: categoryId,
    status: 'approved',
    payment_status: 'paid',
    payment_method: 'CASH',
    application_payment_status: 'COMPLETED',
    approved_at: new Date().toISOString(),
  })

  if (applicationError) {
    throw new Error(`seed application: ${applicationError.message}`)
  }

  return { eventId, eventName }
}

export async function seedWorkflowFixtures(
  supabase: SupabaseClient,
  coordinatorId: string,
  vendorId: string
): Promise<WorkflowFixtures> {
  const { categoryId, categoryName } = await seedVendorPassport(supabase, vendorId)
  const { eventId, eventName } = await seedWorkflowDraftEvent(
    supabase,
    coordinatorId,
    categoryId,
    vendorId
  )

  const fixtures: WorkflowFixtures = {
    draftEventId: eventId,
    draftEventName: eventName,
    categoryId,
    categoryName,
    coordinatorId,
    vendorId,
  }

  writeWorkflowFixtures(fixtures)
  return fixtures
}
