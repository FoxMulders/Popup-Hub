/**
 * Unit checks for coordinator ops-sync mutations — run:
 *   npx tsx lib/coordinator/ops-sync-mutations.test.ts
 */
import assert from 'node:assert/strict'
import {
  applyCoordinatorOpsMutation,
  hasPaymentStatusUpdates,
  pickPaymentStatusUpdates,
  pickVendorReliabilityPatch,
} from './ops-sync-mutations'

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(
    () => console.log(`  ✓ ${name}`),
    (error) => {
      console.error(`  ✗ ${name}`)
      throw error
    }
  )
}

async function main() {
  await test('whitelists payment status fields only', () => {
    assert.deepEqual(
      pickPaymentStatusUpdates({
        payment_status: 'paid',
        application_payment_status: 'COMPLETED',
        status: 'approved',
      }),
      {
        payment_status: 'paid',
        application_payment_status: 'COMPLETED',
      }
    )
    assert.equal(hasPaymentStatusUpdates({ status: 'approved' }), false)
  })

  await test('whitelists vendor reliability fields only', () => {
    assert.deepEqual(
      pickVendorReliabilityPatch({
        late_arrival_count: 2,
        reliability_score: 80,
        is_admin: true,
      }),
      {
        late_arrival_count: 2,
        reliability_score: 80,
      }
    )
  })

  await test('updates vendor reliability via admin client', async () => {
    const profileUpdates: Array<{ vendorId: string; values: Record<string, unknown> }> = []
    const chainEq = async () => ({ error: null })
    const supabase = {
      from: () => ({
        update: () => ({
          eq: () => ({
            eq: chainEq,
          }),
        }),
      }),
    }
    const adminSupabase = {
      from: () => ({
        update: (values: Record<string, unknown>) => ({
          eq: async (_column: string, vendorId: string) => {
            profileUpdates.push({ vendorId, values })
            return { error: null }
          },
        }),
      }),
    }

    const applied = await applyCoordinatorOpsMutation(supabase, adminSupabase, 'evt-1', {
      id: 'mut-1',
      eventId: 'evt-1',
      type: 'load_in_status',
      payload: {
        applicationId: 'app-1',
        load_in_status: 'late',
        vendorId: 'vendor-1',
        reliabilityPatch: {
          late_arrival_count: 3,
          reliability_score: 70,
          is_admin: true,
        },
      },
      clientTimestamp: 1,
      attempts: 0,
    })

    assert.equal(applied, true)
    assert.deepEqual(profileUpdates, [
      {
        vendorId: 'vendor-1',
        values: { late_arrival_count: 3, reliability_score: 70 },
      },
    ])
  })

  await test('rejects payment_status mutations without allowed fields', async () => {
    const applied = await applyCoordinatorOpsMutation(
      {
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        }),
      },
      {
        from: () => ({
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      },
      'evt-1',
      {
        id: 'mut-2',
        eventId: 'evt-1',
        type: 'payment_status',
        payload: {
          applicationId: 'app-1',
          updates: { status: 'approved' },
        },
        clientTimestamp: 1,
        attempts: 0,
      }
    )

    assert.equal(applied, false)
  })

  console.log('ops-sync-mutations tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
