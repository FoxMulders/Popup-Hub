/**
 * A2 coordinator application loop walkthrough for Market Test 3.
 * Run: npx tsx scripts/a2-coordinator-loop-walkthrough.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { generateCheckinToken } from '../lib/checkin-token'

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const eventName = process.env.PLAYWRIGHT_SMOKE_EVENT_NAME ?? 'Market Test 3'
const defaultEventId = '4e87e086-da8e-4e46-af11-b1e7322f4e65'

type Step = { name: string; pass: boolean; detail: string }
const steps: Step[] = []

function record(name: string, pass: boolean, detail: string) {
  steps.push({ name, pass, detail })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}: ${detail}`)
}

async function main() {
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let { data: event } = await supabase
    .from('events')
    .select(
      'id, name, status, coordinator_id, listing_type',
    )
    .eq('id', defaultEventId)
    .maybeSingle()

  if (!event) {
    const { data: byName } = await supabase
      .from('events')
      .select(
        'id, name, status, coordinator_id, listing_type',
      )
      .ilike('name', `%${eventName}%`)
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    event = byName
  }

  if (!event) {
    console.error(`Event not found: ${eventName}`)
    process.exit(1)
  }

  record('event:found', true, `${event.name} (${event.id}) status=${event.status}`)

  const { data: coordinator } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', event.coordinator_id)
    .single()

  record(
    'event:coordinator',
    coordinator?.role === 'coordinator',
    coordinator?.email ?? 'missing coordinator profile',
  )

  const { data: vendorProfile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', 'vendor@me.com')
    .maybeSingle()

  if (!vendorProfile) {
    record('vendor:test-account', false, 'vendor@me.com not found — run seed:test-users')
    printSummary()
    process.exit(1)
  }

  record('vendor:test-account', true, vendorProfile.email ?? vendorProfile.id)

  const FULL_SELECT = `
    *,
    vendor:profiles!booth_applications_vendor_id_fkey(
      id,
      full_name,
      email,
      passport:vendor_passports(
        business_name,
        bio,
        logo_url,
        item_image_urls,
        is_verified,
        primary_category_id,
        category_ids
      )
    ),
    category:categories(name)
  `

  let { data: application } = await supabase
    .from('booth_applications')
    .select('id, status, payment_status, coordinator_review_notes, checked_in, vendor_id')
    .eq('event_id', event.id)
    .eq('vendor_id', vendorProfile.id)
    .order('applied_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!application) {
    const { data: categoryLimit } = await supabase
      .from('event_category_limits')
      .select('category_id, price_per_booth')
      .eq('event_id', event.id)
      .limit(1)
      .maybeSingle()

    if (!categoryLimit) {
      record('apply:create', false, 'No category limits on event')
      printSummary()
      process.exit(1)
    }

    const boothFee = categoryLimit?.price_per_booth ?? 0
    const { data: created, error: createError } = await supabase
      .from('booth_applications')
      .insert({
        event_id: event.id,
        vendor_id: vendorProfile.id,
        category_id: categoryLimit.category_id,
        status: 'pending',
        payment_status: boothFee > 0 ? 'unpaid' : 'unpaid',
      })
      .select('id, status, payment_status, coordinator_review_notes, checked_in, vendor_id')
      .single()

    if (createError) {
      record('apply:create', false, createError.message)
      printSummary()
      process.exit(1)
    }

    application = created
    record('apply:create', true, `Created pending application ${application.id}`)
  } else if (application.status === 'declined' || application.status === 'cancelled') {
    const { data: reset, error: resetError } = await supabase
      .from('booth_applications')
      .update({ status: 'pending', payment_status: 'unpaid', checked_in: false })
      .eq('id', application.id)
      .select('id, status, payment_status, coordinator_review_notes, checked_in, vendor_id')
      .single()

    if (resetError) {
      record('apply:reset', false, resetError.message)
    } else {
      application = reset!
      record('apply:reset', true, `Reset application ${application.id} to pending`)
    }
  } else {
    record('apply:exists', true, `${application.id} status=${application.status}`)
  }

  const { data: fullApp, error: fullError } = await supabase
    .from('booth_applications')
    .select(FULL_SELECT)
    .eq('id', application!.id)
    .single()

  record(
    'review:passport-nested-select',
    !fullError && !!fullApp,
    fullError?.message ?? 'Coordinator drawer data loads',
  )

  const testNotes = `A2 walkthrough ${new Date().toISOString()}`
  const { error: notesError } = await supabase
    .from('booth_applications')
    .update({ coordinator_review_notes: testNotes })
    .eq('id', application!.id)

  record(
    'review:save-notes',
    !notesError,
    notesError?.message ?? `Saved notes (${testNotes.slice(0, 24)}…)`,
  )

  const { data: notesRow } = await supabase
    .from('booth_applications')
    .select('coordinator_review_notes')
    .eq('id', application!.id)
    .single()

  record(
    'review:notes-persisted',
    notesRow?.coordinator_review_notes === testNotes,
    notesRow?.coordinator_review_notes?.slice(0, 40) ?? 'empty',
  )

  if (application!.status === 'pending' || application!.status === 'waitlisted') {
    const { data: appCategory } = await supabase
      .from('booth_applications')
      .select('category_id')
      .eq('id', application!.id)
      .single()

    const { data: limitRow } = await supabase
      .from('event_category_limits')
      .select('price_per_booth')
      .eq('event_id', event.id)
      .eq('category_id', appCategory?.category_id ?? '')
      .maybeSingle()

    const boothFee = limitRow?.price_per_booth ?? 0

    const { data: approved, error: approveError } = await supabase
      .from('booth_applications')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        payment_status: boothFee > 0 ? 'unpaid' : 'unpaid',
      })
      .eq('id', application!.id)
      .select('id, status, payment_status')
      .single()

    record(
      'approve:application',
      !approveError && approved?.status === 'approved',
      approveError?.message ?? `status=${approved?.status} payment=${approved?.payment_status}`,
    )
    application = { ...application!, ...approved! }
  } else {
    record('approve:application', application!.status === 'approved', `Already ${application!.status}`)
  }

  const paymentOk =
    application!.payment_status === 'unpaid' ||
    application!.payment_status === 'paid' ||
    application!.payment_status === 'payment_required' ||
    application!.payment_status === 'pending'

  record(
    'pay:status-valid',
    paymentOk,
    `payment_status=${application!.payment_status} (Square/e-transfer manual if unpaid)`,
  )

  if (application!.payment_status === 'unpaid') {
    record(
      'pay:square-manual',
      true,
      'Unpaid booth — coordinator Square OAuth + vendor checkout required for live payment',
    )
  }

  const { data: checkedIn, error: checkinError } = await supabase
    .from('booth_applications')
    .update({ checked_in: true })
    .eq('id', application!.id)
    .select('checked_in')
    .single()

  record(
    'checkin:coordinator-toggle',
    !checkinError && checkedIn?.checked_in === true,
    checkinError?.message ?? 'checked_in=true',
  )

  let token: string | null = null
  try {
    token = generateCheckinToken(event.id, application!.id)
    record('checkin:token-generated', !!token, token ? `${token.slice(0, 12)}…` : 'failed')
  } catch (err) {
    record(
      'checkin:token-generated',
      false,
      err instanceof Error ? err.message : 'CHECKIN_SECRET missing',
    )
  }

  const prodBase = process.env.NEXT_PUBLIC_APP_URL ?? 'https://popup-hub.vercel.app'
  const urls = [
    `${prodBase}/coordinator/events/${event.id}/applications`,
    `${prodBase}/vendor/events/${event.id}`,
    `${prodBase}/events/${event.id}`,
    `${prodBase}/discover`,
    token ? `${prodBase}/checkin/${token}` : null,
  ].filter(Boolean) as string[]

  for (const checkUrl of urls) {
    try {
      const res = await fetch(checkUrl, { redirect: 'follow' })
      record(`http:${new URL(checkUrl).pathname}`, res.status < 500, `HTTP ${res.status}`)
    } catch (err) {
      record(
        `http:${new URL(checkUrl).pathname}`,
        false,
        err instanceof Error ? err.message : 'fetch failed',
      )
    }
  }

  printSummary()
  process.exit(steps.some((s) => !s.pass) ? 1 : 0)
}

function printSummary() {
  const failed = steps.filter((s) => !s.pass)
  console.log('')
  console.log(`A2 walkthrough: ${steps.length - failed.length}/${steps.length} passed`)
  if (failed.length) {
    console.log('Failed steps:')
    for (const step of failed) console.log(`  - ${step.name}: ${step.detail}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
