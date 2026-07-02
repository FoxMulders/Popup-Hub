/**
 * Unit checks for ad click tracking — run:
 *   npx tsx lib/markets/ad-click-tracking.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hashClientIpForAdClick, recordAdClick } from './ad-click-tracking'

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(
    () => console.log(`  ✓ ${name}`),
    (e) => {
      console.error(`  ✗ ${name}`)
      throw e
    }
  )
}

async function main() {
  console.log('ad-click-tracking')

  await test('hashClientIpForAdClick is stable per day', () => {
    const hash = hashClientIpForAdClick('203.0.113.10')
    assert.equal(hash.length, 64)
    assert.equal(hash, hashClientIpForAdClick('203.0.113.10'))
  })

  await test('recordAdClick treats duplicate ip/day as non-insert', async () => {
    const supabase = {
      from: () => ({
        insert: async () => ({ error: { code: '23505', message: 'duplicate' } }),
      }),
    }
    const result = await recordAdClick(supabase as never, {
      marketId: 'market-1',
      ipAddressHash: 'abc',
    })
    assert.equal(result.inserted, false)
  })

  await test('recordAdClick propagates RLS and other insert errors', async () => {
    const supabase = {
      from: () => ({
        insert: async () => ({ error: { code: '42501', message: 'RLS denied' } }),
      }),
    }
    await assert.rejects(
      () =>
        recordAdClick(supabase as never, {
          marketId: 'market-1',
          ipAddressHash: 'abc',
        }),
      (err: { code?: string }) => err?.code === '42501'
    )
  })

  await test('track-click route uses createAdminClient (RLS INSERT is false)', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/api/v1/markets/[id]/track-click/route.ts'),
      'utf8'
    )
    assert.match(source, /createAdminClient\(\)/)
    assert.doesNotMatch(source, /createServiceClient\(\)/)
  })

  console.log('All ad-click-tracking tests passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
