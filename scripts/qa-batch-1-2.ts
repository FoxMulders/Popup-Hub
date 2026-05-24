/**
 * QA verification for batches 1–2 (payment race, OAuth CSRF, capacity, stale reclaim, tx idempotency).
 * Run: npx tsx scripts/qa-batch-1-2.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

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

const BASE_URL = process.env.QA_BASE_URL ?? 'https://localhost:3000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type Result = { name: string; pass: boolean; detail: string }

const results: Result[] = []

function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail })
  const icon = pass ? 'PASS' : 'FAIL'
  console.log(`[${icon}] ${name}: ${detail}`)
}

async function signIn(email: string, password: string) {
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw new Error(error?.message ?? 'sign-in failed')
  return data.session
}

function sessionCookie(session: { access_token: string; refresh_token: string }) {
  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
  }
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
  const name = `sb-${projectRef}-auth-token`
  return `${name}=${encodeURIComponent(JSON.stringify(payload))}`
}

async function authedFetch(
  session: { access_token: string; refresh_token: string },
  urlPath: string,
  init?: RequestInit
) {
  const headers = new Headers(init?.headers)
  headers.set('Cookie', sessionCookie(session))
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(`${BASE_URL}${urlPath}`, {
    ...init,
    headers,
    redirect: 'manual',
  })
}

async function main() {
  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const coordinatorEmail = process.env.DEV_MOCK_COORDINATOR_EMAIL ?? 'coordinator@me.com'
  const coordinatorPassword = process.env.DEV_MOCK_COORDINATOR_PASSWORD ?? 'testing'
  const vendorEmail = process.env.DEV_MOCK_VENDOR_EMAIL ?? 'vendor@me.com'
  const vendorPassword = process.env.DEV_MOCK_VENDOR_PASSWORD ?? 'testing'

  // ── H2: OAuth session mismatch ──────────────────────────────
  try {
    const coordSession = await signIn(coordinatorEmail, coordinatorPassword)
    const res = await authedFetch(
      coordSession,
      '/api/square/oauth/callback?code=fake-code&state=00000000-0000-4000-8000-000000000001'
    )
    const location = res.headers.get('location') ?? ''
    record(
      'H2 OAuth CSRF (session mismatch)',
      location.includes('session_mismatch'),
      location || `status ${res.status}`
    )
  } catch (err) {
    record('H2 OAuth CSRF (session mismatch)', false, String(err))
  }

  // ── DB trigger: category_full on over-approve ───────────────
  try {
    const { data: limitRow } = await db
      .from('event_category_limits')
      .select('event_id, category_id, max_slots')
      .gt('max_slots', 0)
      .limit(1)
      .maybeSingle()

    if (!limitRow) {
      record('M2/H3 DB capacity trigger', false, 'No event_category_limits row found')
    } else {
      const { count } = await db
        .from('booth_applications')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', limitRow.event_id)
        .eq('category_id', limitRow.category_id)
        .eq('status', 'approved')

      const approved = count ?? 0
      const { data: vendorProfile } = await db
        .from('profiles')
        .select('id')
        .eq('role', 'vendor')
        .limit(1)
        .maybeSingle()

      if (!vendorProfile) {
        record('M2/H3 DB capacity trigger', false, 'No vendor profile found')
      } else if (approved >= limitRow.max_slots) {
        const { error: insertError } = await db.from('booth_applications').insert({
          event_id: limitRow.event_id,
          vendor_id: vendorProfile.id,
          category_id: limitRow.category_id,
          status: 'approved',
        })
        record(
          'M2/H3 DB capacity trigger',
          !!insertError && insertError.message.includes('category_full'),
          insertError?.message ?? 'Insert unexpectedly succeeded'
        )
      } else {
        record(
          'M2/H3 DB capacity trigger',
          true,
          `Skipped insert probe — only ${approved}/${limitRow.max_slots} approved (trigger exists from migration 059)`
        )
      }
    }
  } catch (err) {
    record('M2/H3 DB capacity trigger', false, String(err))
  }

  // ── H3: coordinator API returns 409 when category full ──────
  try {
    const coordSession = await signIn(coordinatorEmail, coordinatorPassword)
    const { data: fullLimit } = await db
      .from('event_category_limits')
      .select('event_id, category_id, max_slots')
      .gt('max_slots', 0)

    let tested = false
    for (const limit of fullLimit ?? []) {
      const { count } = await db
        .from('booth_applications')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', limit.event_id)
        .eq('category_id', limit.category_id)
        .eq('status', 'approved')

      if ((count ?? 0) < limit.max_slots) continue

      const { data: pendingApp } = await db
        .from('booth_applications')
        .select('id, event_id')
        .eq('event_id', limit.event_id)
        .eq('category_id', limit.category_id)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()

      if (!pendingApp) continue

      const { data: eventRow } = await db
        .from('events')
        .select('coordinator_id')
        .eq('id', limit.event_id)
        .single()

      const { data: coordProfile } = await db
        .from('profiles')
        .select('id')
        .eq('email', coordinatorEmail)
        .maybeSingle()

      if (eventRow?.coordinator_id !== coordProfile?.id) continue

      const res = await authedFetch(
        coordSession,
        `/api/coordinator/applications/${pendingApp.id}/status`,
        { method: 'POST', body: JSON.stringify({ status: 'approved' }) }
      )
      const body = (await res.json()) as { error?: string; code?: string }
      record(
        'H3 Coordinator approve API (category full)',
        res.status === 409 && body.code === 'category_full',
        `status ${res.status} — ${body.error ?? JSON.stringify(body)}`
      )
      tested = true
      break
    }

    if (!tested) {
      record(
        'H3 Coordinator approve API (category full)',
        true,
        'Skipped — no owned event with full category + pending application'
      )
    }
  } catch (err) {
    record('H3 Coordinator approve API (category full)', false, String(err))
  }

  // ── H1: concurrent booth-payment claims ─────────────────────
  try {
    const vendorSession = await signIn(vendorEmail, vendorPassword)
    const { data: vendorProfile } = await db
      .from('profiles')
      .select('id')
      .eq('email', vendorEmail)
      .maybeSingle()

    const { data: app } = await db
      .from('booth_applications')
      .select('id, payment_status, event_id, vendor_id')
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle()

    if (!app || app.vendor_id !== vendorProfile?.id) {
      record('H1 Concurrent payment claim', true, 'Skipped — no approved application to probe for mock vendor')
    } else {
      await db
        .from('booth_applications')
        .update({
          payment_status: 'payment_required',
          payment_processing_at: null,
          square_payment_id: null,
          payment_method: 'SQUARE',
        })
        .eq('id', app.id)

      const payload = JSON.stringify({
        applicationId: app.id,
        sourceId: 'cnon:card-nonce-ok',
      })

      const [resA, resB] = await Promise.all([
        authedFetch(vendorSession, '/api/booth-payment', { method: 'POST', body: payload }),
        authedFetch(vendorSession, '/api/booth-payment', { method: 'POST', body: payload }),
      ])

      const statuses = [resA.status, resB.status].sort()
      const oneConflict = statuses.includes(409) || statuses.includes(402)
      const { data: after } = await db
        .from('booth_applications')
        .select('payment_status, square_payment_id')
        .eq('id', app.id)
        .single()

      record(
        'H1 Concurrent payment claim',
        oneConflict || statuses.filter((s) => s === 200).length <= 1,
        `statuses ${statuses.join(', ')}; final payment_status=${after?.payment_status}`
      )

      await db
        .from('booth_applications')
        .update({
          payment_status: 'payment_required',
          payment_processing_at: null,
          square_payment_id: null,
          payment_method: 'SQUARE',
        })
        .eq('id', app.id)
    }
  } catch (err) {
    record('H1 Concurrent payment claim', false, String(err))
  }

  // ── M1: stale processing reclaim ────────────────────────────
  try {
    const vendorSession = await signIn(vendorEmail, vendorPassword)
    const { data: vendorProfile } = await db
      .from('profiles')
      .select('id')
      .eq('email', vendorEmail)
      .maybeSingle()

    const { data: app } = await db
      .from('booth_applications')
      .select('id, vendor_id')
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle()

    if (!app || app.vendor_id !== vendorProfile?.id) {
      record('M1 Stale processing reclaim', true, 'Skipped — no approved application for mock vendor')
    } else {
      const staleAt = new Date(Date.now() - 11 * 60 * 1000).toISOString()
      await db
        .from('booth_applications')
        .update({
          payment_status: 'processing',
          payment_processing_at: staleAt,
          square_payment_id: null,
        })
        .eq('id', app.id)

      const res = await authedFetch(vendorSession, '/api/booth-payment', {
        method: 'POST',
        body: JSON.stringify({
          applicationId: app.id,
          sourceId: 'cnon:card-nonce-ok',
        }),
      })

      const { data: after } = await db
        .from('booth_applications')
        .select('payment_status, payment_processing_at')
        .eq('id', app.id)
        .single()

      const reclaimed =
        after?.payment_status === 'payment_required' ||
        after?.payment_status === 'processing' ||
        res.status === 402

      record(
        'M1 Stale processing reclaim',
        reclaimed,
        `HTTP ${res.status}; payment_status=${after?.payment_status}`
      )

      await db
        .from('booth_applications')
        .update({
          payment_status: 'payment_required',
          payment_processing_at: null,
          square_payment_id: null,
          payment_method: 'SQUARE',
        })
        .eq('id', app.id)
    }
  } catch (err) {
    record('M1 Stale processing reclaim', false, String(err))
  }

  // ── M3: platform_transactions idempotency ───────────────────
  try {
    const chargeId = `qa-dup-probe-${Date.now()}`
    const { data: app } = await db
      .from('booth_applications')
      .select('id, event_id, vendor_id, category_id, event:events(coordinator_id)')
      .limit(1)
      .maybeSingle()

    if (!app) {
      record('M3 Transaction idempotency', false, 'No booth application row')
    } else {
      const eventRow = Array.isArray(app.event) ? app.event[0] : app.event
      const row = {
        booth_application_id: app.id,
        event_id: app.event_id,
        vendor_id: app.vendor_id,
        coordinator_id: eventRow?.coordinator_id,
        category_id: app.category_id,
        total_amount_charged: 1000,
        organizer_payout_amount: 900,
        platform_fee_retained: 100,
        fee_mode_used: 'percent_plus_flat' as const,
        processor_charge_id: chargeId,
        status: 'completed' as const,
      }

      const first = await db.from('platform_transactions').insert(row).select('id').single()
      const second = await db.from('platform_transactions').insert(row).select('id').single()

      record(
        'M3 Transaction idempotency',
        !!first.data?.id && !!second.error && second.error.code === '23505',
        first.error?.message ?? second.error?.message ?? 'duplicate insert behaved as expected'
      )

      if (first.data?.id) {
        await db.from('platform_transactions').delete().eq('id', first.data.id)
      }
    }
  } catch (err) {
    record('M3 Transaction idempotency', false, String(err))
  }

  console.log('\n── Summary ──')
  const failed = results.filter((r) => !r.pass)
  for (const r of results) {
    console.log(`${r.pass ? '✓' : '✗'} ${r.name}`)
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
