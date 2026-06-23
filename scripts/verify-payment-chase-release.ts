/**
 * Smoke test for vendor payment chase auto-release + waitlist promotion.
 * Requires SUPABASE_SERVICE_ROLE_KEY and a seeded event with waitlisted vendor.
 *
 * Usage: npx tsx scripts/verify-payment-chase-release.ts <eventId> <unpaidApplicationId>
 */
import { createClient } from '@supabase/supabase-js'
import { chaseUnpaidPayments } from '../lib/applications/chase-unpaid-payments'

async function main() {
  const eventId = process.argv[2]
  const applicationId = process.argv[3]
  if (!eventId || !applicationId) {
    console.error('Usage: npx tsx scripts/verify-payment-chase-release.ts <eventId> <applicationId>')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const pastDue = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { error: seedError } = await supabase
    .from('booth_applications')
    .update({
      payment_due_at: pastDue,
      payment_reminder_stage: 3,
    })
    .eq('id', applicationId)
    .eq('event_id', eventId)

  if (seedError) {
    console.error('Failed to seed past-due application:', seedError.message)
    process.exit(1)
  }

  const result = await chaseUnpaidPayments(supabase)
  console.log('Chase result:', result)

  const { data: app } = await supabase
    .from('booth_applications')
    .select('id, status, application_payment_status, payment_due_at')
    .eq('id', applicationId)
    .single()

  console.log('Application after chase:', app)

  if (app?.status !== 'cancelled') {
    console.error('Expected application to be cancelled after overdue chase')
    process.exit(1)
  }

  console.log('PASS — overdue application released')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
