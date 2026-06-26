/**
 * Unit checks for coordinator ops snapshot bootstrap — run:
 *   npx tsx lib/pwa/coordinator-ops-snapshot-init.test.ts
 */
import assert from 'node:assert/strict'
import { resolveCoordinatorOpsSnapshotApplications } from './coordinator-ops-snapshot-init'

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
  const serverApps = [{ id: 'server', checked_in: false }]
  const cachedApps = [{ id: 'cached', checked_in: true }]

  await test('hydrates from cache when offline and cache exists', async () => {
    const result = await resolveCoordinatorOpsSnapshotApplications({
      isOnline: false,
      eventId: 'evt-1',
      serverApplications: serverApps,
      loadCachedApplications: async () => cachedApps,
    })
    assert.deepEqual(result, { applications: cachedApps, hydratedFromCache: true })
  })

  await test('uses server applications when online', async () => {
    const result = await resolveCoordinatorOpsSnapshotApplications({
      isOnline: true,
      eventId: 'evt-1',
      serverApplications: serverApps,
      loadCachedApplications: async () => cachedApps,
    })
    assert.deepEqual(result, { applications: serverApps, hydratedFromCache: false })
  })

  await test('falls back to server applications when offline without cache', async () => {
    const result = await resolveCoordinatorOpsSnapshotApplications({
      isOnline: false,
      eventId: 'evt-1',
      serverApplications: serverApps,
      loadCachedApplications: async () => null,
    })
    assert.deepEqual(result, { applications: serverApps, hydratedFromCache: false })
  })

  console.log('coordinator-ops-snapshot-init tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
