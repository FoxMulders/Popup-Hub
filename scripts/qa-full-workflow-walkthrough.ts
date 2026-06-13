/**
 * Full workflow API/DB walkthrough for QA regression.
 * Run: npx tsx scripts/qa-full-workflow-walkthrough.ts
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

type Step = { name: string; pass: boolean; detail: string }
const steps: Step[] = []

function record(name: string, pass: boolean, detail: string) {
  steps.push({ name, pass, detail })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}: ${detail}`)
}

type WorkflowFixtures = {
  draftEventId: string
  draftEventName: string
  categoryId: string
  categoryName: string
  coordinatorId: string
  vendorId: string
}

function readFixtures(): WorkflowFixtures | null {
  const fixturesPath = path.join(process.cwd(), 'tests/e2e/workflow/.fixtures.json')
  try {
    return JSON.parse(fs.readFileSync(fixturesPath, 'utf8')) as WorkflowFixtures
  } catch {
    return null
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const fixtures = readFixtures()
  const vendorEmail = process.env.DEV_MOCK_VENDOR_EMAIL ?? 'vendor@me.com'
  const coordinatorEmail = process.env.DEV_MOCK_COORDINATOR_EMAIL ?? 'coordinator@me.com'

  const { data: vendorProfile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', vendorEmail)
    .maybeSingle()

  record(
    'seed:vendor-account',
    vendorProfile?.role === 'vendor',
    vendorProfile?.email ?? `missing ${vendorEmail} — run npm run seed:test-users`
  )

  const { data: coordinatorProfile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', coordinatorEmail)
    .maybeSingle()

  record(
    'seed:coordinator-account',
    coordinatorProfile?.role === 'coordinator',
    coordinatorProfile?.email ?? `missing ${coordinatorEmail}`
  )

  if (!vendorProfile) {
    printSummary()
    process.exit(1)
  }

  const { data: passport } = await supabase
    .from('vendor_passports')
    .select('business_name, primary_category_id, category_ids')
    .eq('user_id', vendorProfile.id)
    .maybeSingle()

  const passportReady = Boolean(
    passport?.business_name?.trim() && (passport.primary_category_id || passport.category_ids?.length)
  )
  record(
    'passport:ready',
    passportReady,
    passport?.business_name ?? 'no passport — run npm run seed:test-users'
  )

  let eventId =
    process.env.PLAYWRIGHT_WORKFLOW_EVENT_ID ??
    fixtures?.draftEventId ??
    process.env.PLAYWRIGHT_SMOKE_EVENT_ID

  if (eventId) {
    const { data: event } = await supabase
      .from('events')
      .select('id, name, status, coordinator_id')
      .eq('id', eventId)
      .maybeSingle()

    record(
      'event:found',
      Boolean(event),
      event ? `${event.name} (${event.id}) status=${event.status}` : `not found: ${eventId}`
    )

    if (event && ['draft', 'published', 'active'].includes(event.status)) {
      const publishPayload = { status: 'published' as const }
      if (event.status === 'draft') {
        const { error: publishError } = await supabase
          .from('events')
          .update(publishPayload)
          .eq('id', event.id)
        record(
          'event:publish-for-walkthrough',
          !publishError,
          publishError?.message ?? 'draft → published'
        )
      } else {
        record('event:publish-for-walkthrough', true, `already ${event.status}`)
      }
    }
  } else {
    const { data: latest } = await supabase
      .from('events')
      .select('id, name, status')
      .in('status', ['published', 'active'])
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    eventId = latest?.id
    record(
      'event:found',
      Boolean(latest),
      latest ? `${latest.name} (${latest.id})` : 'no published event'
    )
  }

  if (!eventId) {
    printSummary()
    process.exit(1)
  }

  const { data: categoryLimit } = await supabase
    .from('event_category_limits')
    .select('category_id, price_per_booth')
    .eq('event_id', eventId)
    .limit(1)
    .maybeSingle()

  record(
    'event:category-limit',
    Boolean(categoryLimit),
    categoryLimit ? `category=${categoryLimit.category_id}` : 'no limits on event'
  )

  let { data: application } = await supabase
    .from('booth_applications')
    .select('id, status, payment_status, booth_number, vendor_id')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorProfile.id)
    .maybeSingle()

  if (!application && categoryLimit) {
    const { data: created, error: createError } = await supabase
      .from('booth_applications')
      .insert({
        event_id: eventId,
        vendor_id: vendorProfile.id,
        category_id: categoryLimit.category_id,
        status: 'pending',
        payment_status: 'unpaid',
      })
      .select('id, status, payment_status, booth_number, vendor_id')
      .single()

    record(
      'apply:create',
      !createError && Boolean(created),
      createError?.message ?? `Created pending application ${created?.id}`
    )
    application = created
  } else if (application) {
    if (application.status === 'declined' || application.status === 'cancelled') {
      const { data: reset, error: resetError } = await supabase
        .from('booth_applications')
        .update({ status: 'pending', payment_status: 'unpaid', checked_in: false, booth_number: null })
        .eq('id', application.id)
        .select('id, status, payment_status, booth_number, vendor_id')
        .single()
      record(
        'apply:reset',
        !resetError,
        resetError?.message ?? `Reset to pending (${application.id})`
      )
      application = reset ?? application
    } else {
      record('apply:exists', true, `${application.id} status=${application.status}`)
    }
  }

  if (application && (application.status === 'pending' || application.status === 'waitlisted')) {
    const boothFee = categoryLimit?.price_per_booth ?? 0
    const { data: approved, error: approveError } = await supabase
      .from('booth_applications')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        payment_status: boothFee > 0 ? 'unpaid' : 'unpaid',
      })
      .eq('id', application.id)
      .select('id, status, payment_status, booth_number')
      .single()

    record(
      'approve:application',
      !approveError && approved?.status === 'approved',
      approveError?.message ?? `status=${approved?.status}`
    )
    application = { ...application, ...approved! }
  } else if (application) {
    record('approve:application', application.status === 'approved', `Already ${application.status}`)
  }

  const { data: layout } = await supabase
    .from('booth_layouts')
    .select('cells, layout_rooms')
    .eq('event_id', eventId)
    .maybeSingle()

  const cells = (layout?.cells as Array<{ vendorName?: string; boothNumber?: number }> | null) ?? []
  const placedVendorCell = cells.find(
    (cell) => cell.vendorName && cell.vendorName.toLowerCase().includes('qa test vendor')
  )

  record(
    'assign:layout-cell',
    Boolean(placedVendorCell),
    placedVendorCell
      ? `booth ${placedVendorCell.boothNumber ?? '?'} — ${placedVendorCell.vendorName}`
      : 'no vendor cell yet (manual auto-place optional)'
  )

  const boothAssigned =
    application?.booth_number != null && application.booth_number > 0
  record(
    'assign:booth-number',
    boothAssigned || Boolean(placedVendorCell),
    boothAssigned
      ? `booth_number=${application?.booth_number}`
      : 'booth_number unset — OK if layout cell placed'
  )

  if (application) {
    const { error: checkinError } = await supabase
      .from('booth_applications')
      .update({ checked_in: true })
      .eq('id', application.id)

    record(
      'checkin:coordinator-toggle',
      !checkinError,
      checkinError?.message ?? 'checked_in=true'
    )
  }

  let token: string | null = null
  try {
    if (application) {
      token = generateCheckinToken(eventId, application.id)
      record('checkin:token-generated', Boolean(token), token ? `${token.slice(0, 12)}…` : 'failed')
    }
  } catch (err) {
    record(
      'checkin:token-generated',
      false,
      err instanceof Error ? err.message : 'CHECKIN_SECRET missing'
    )
  }

  const prodBase = process.env.PLAYWRIGHT_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const urls = [
    `${prodBase}/coordinator/events/${eventId}/applications`,
    `${prodBase}/vendor/events/${eventId}`,
    `${prodBase}/events/${eventId}`,
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
        err instanceof Error ? err.message : 'fetch failed'
      )
    }
  }

  printSummary()

  const hardFailures = steps.filter(
    (s) =>
      !s.pass &&
      !s.name.startsWith('assign:') &&
      !s.name.startsWith('http:') &&
      s.name !== 'checkin:token-generated'
  )
  process.exit(hardFailures.length > 0 ? 1 : 0)
}

function printSummary() {
  const failed = steps.filter((s) => !s.pass)
  console.log('')
  console.log(`Full workflow walkthrough: ${steps.length - failed.length}/${steps.length} passed`)
  if (failed.length) {
    console.log('Failed or skipped steps:')
    for (const step of failed) console.log(`  - ${step.name}: ${step.detail}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
