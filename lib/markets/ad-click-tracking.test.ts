import assert from 'node:assert/strict'
import { hashClientIpForAdClick, recordAdClick } from './ad-click-tracking'

async function run() {
  const hash = hashClientIpForAdClick('203.0.113.10')
  assert.equal(hash.length, 64)
  assert.equal(hash, hashClientIpForAdClick('203.0.113.10'))

  let rejected = false
  try {
    await recordAdClick(
      {
        from: () => ({
          insert: async () => ({
            error: { code: '42501', message: 'new row violates row-level security policy' },
          }),
        }),
      } as never,
      {
        marketId: '00000000-0000-4000-8000-000000000001',
        ipAddressHash: 'abc',
      }
    )
  } catch (err) {
    rejected = (err as { code?: string }).code === '42501'
  }
  assert.equal(rejected, true, 'RLS policy errors must propagate (use createAdminClient in routes)')

  const duplicate = await recordAdClick(
    {
      from: () => ({
        insert: async () => ({ error: { code: '23505' } }),
      }),
    } as never,
    {
      marketId: '00000000-0000-4000-8000-000000000001',
      ipAddressHash: 'abc',
    }
  )
  assert.deepEqual(duplicate, { inserted: false })

  console.log('ad-click-tracking tests passed')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
