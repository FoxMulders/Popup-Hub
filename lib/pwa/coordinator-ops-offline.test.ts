/**
 * Coordinator ops offline queue — run:
 *   npx tsx lib/pwa/coordinator-ops-offline.test.ts
 */
import assert from 'node:assert/strict'
import { createEventFlushSerializer } from './coordinator-ops-offline'

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn())
    .then(() => console.log(`  ✓ ${name}`))
    .catch((error) => {
      console.error(`  ✗ ${name}`)
      throw error
    })
}

async function main() {
  console.log('coordinator-ops-offline')

  await test('serializes concurrent flushes for the same event', async () => {
    const withLock = createEventFlushSerializer()
    const order: string[] = []

    const first = withLock('event-a', async () => {
      order.push('first-start')
      await new Promise((resolve) => setTimeout(resolve, 30))
      order.push('first-end')
      return 'first'
    })

    const second = withLock('event-a', async () => {
      order.push('second-start')
      order.push('second-end')
      return 'second'
    })

    const [firstResult, secondResult] = await Promise.all([first, second])
    assert.equal(firstResult, 'first')
    assert.equal(secondResult, 'second')
    assert.deepEqual(order, ['first-start', 'first-end', 'second-start', 'second-end'])
  })

  await test('does not block flushes for different events', async () => {
    const withLock = createEventFlushSerializer()
    const order: string[] = []

    const eventA = withLock('event-a', async () => {
      order.push('a-start')
      await new Promise((resolve) => setTimeout(resolve, 30))
      order.push('a-end')
    })

    const eventB = withLock('event-b', async () => {
      order.push('b-start')
      order.push('b-end')
    })

    await Promise.all([eventA, eventB])
    assert.deepEqual(order, ['a-start', 'b-start', 'b-end', 'a-end'])
  })

  console.log('All coordinator-ops-offline tests passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
