/**
 * Unit checks for HubGrid draft deploy — run:
 *   npx tsx lib/coordinator/hub-grid-deploy-draft-market.test.ts
 */
import assert from 'node:assert/strict'
import { deployDraftMarketFromHubGrid } from './hub-grid-deploy-draft-market'

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
    } catch (e) {
      console.error(`  ✗ ${name}`)
      throw e
    }
  })()
}

async function run() {
  console.log('deployDraftMarketFromHubGrid')

  await test('blocks when publish gate fails', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/coordinator/verification')) {
        return new Response(JSON.stringify({ publishBlockReason: 'Connect payments first.' }), {
          status: 200,
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      const result = await deployDraftMarketFromHubGrid('evt-1')
      assert.equal(result.ok, false)
      if (!result.ok) {
        assert.equal(result.error, 'Connect payments first.')
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  await test('publishes draft via PATCH when gate passes', async () => {
    const originalFetch = globalThis.fetch
    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push(url)
      if (url.endsWith('/api/coordinator/verification')) {
        return new Response(JSON.stringify({ publishBlockReason: null }), { status: 200 })
      }
      if (url.endsWith('/api/coordinator/events/evt-42')) {
        assert.equal(init?.method, 'PATCH')
        assert.equal(init?.headers && (init.headers as Record<string, string>)['Content-Type'], 'application/json')
        assert.equal(init?.body, JSON.stringify({ status: 'published' }))
        return new Response(JSON.stringify({ ok: true, status: 'published' }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      const result = await deployDraftMarketFromHubGrid('evt-42')
      assert.equal(result.ok, true)
      assert.deepEqual(calls, [
        '/api/coordinator/verification',
        '/api/coordinator/events/evt-42',
      ])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  await test('surfaces API publish errors', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/coordinator/verification')) {
        return new Response(JSON.stringify({ publishBlockReason: null }), { status: 200 })
      }
      if (url.endsWith('/api/coordinator/events/evt-9')) {
        return new Response(JSON.stringify({ error: 'Venue must be verified.' }), { status: 400 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      const result = await deployDraftMarketFromHubGrid('evt-9')
      assert.equal(result.ok, false)
      if (!result.ok) {
        assert.equal(result.error, 'Venue must be verified.')
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  console.log('All hub-grid deploy tests passed.')
}

void run()
