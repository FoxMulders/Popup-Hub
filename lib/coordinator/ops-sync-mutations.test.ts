import assert from 'node:assert/strict'
import { pickOpsSyncPaymentStatusUpdates } from './ops-sync-mutations'

{
  const picked = pickOpsSyncPaymentStatusUpdates({
    payment_status: 'paid',
    application_payment_status: 'COMPLETED',
    status: 'approved',
    booth_number: 42,
  })
  assert.deepEqual(picked, {
    payment_status: 'paid',
    application_payment_status: 'COMPLETED',
  })
}

{
  const picked = pickOpsSyncPaymentStatusUpdates({ booth_number: 1 })
  assert.deepEqual(picked, {})
}

console.log('ops-sync-mutations.test.ts: PASS')
