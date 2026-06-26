/**
 * Unit checks for coordinator offline ops sync apply logic — run:
 *   npx tsx lib/coordinator/ops-sync-apply.test.ts
 */
import assert from 'node:assert/strict'
import { applyCoordinatorOpsMutation } from './ops-sync-apply'
import type { PendingCoordinatorMutation } from '@/lib/pwa/coordinator-ops-offline'

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(
    () => console.log(`  ✓ ${name}`),
    (e) => {
      console.error(`  ✗ ${name}`)
      throw e
    }
  )
}

function mutation(
  overrides: Partial<PendingCoordinatorMutation> & Pick<PendingCoordinatorMutation, 'type'>
): PendingCoordinatorMutation {
  return {
    id: 'mut-1',
    eventId: 'evt-1',
    payload: {},
    clientTimestamp: 1,
    attempts: 0,
    ...overrides,
  }
}

type UpdateResult = { data: { id: string } | null; error: { message: string } | null }

function mockSupabase(updateResult: UpdateResult) {
  const chain = {
    eq: () => chain,
    select: () => chain,
    maybeSingle: async () => updateResult,
    update: () => chain,
  }
  return {
    from: (table: string) => {
      assert.equal(table, 'booth_applications')
      return chain
    },
  }
}

async function main() {
  console.log('ops-sync-apply')

  await test('check_in returns false when update matches zero rows', async () => {
    const supabase = mockSupabase({ data: null, error: null })
    const applied = await applyCoordinatorOpsMutation(supabase, 'evt-1', mutation({
      type: 'check_in',
      payload: { applicationId: 'missing-app', checked_in: true },
    }))
    assert.equal(applied, false)
  })

  await test('check_in returns true when a row is updated', async () => {
    const supabase = mockSupabase({ data: { id: 'app-1' }, error: null })
    const applied = await applyCoordinatorOpsMutation(supabase, 'evt-1', mutation({
      type: 'check_in',
      payload: { applicationId: 'app-1', checked_in: true },
    }))
    assert.equal(applied, true)
  })

  await test('check_in returns false for empty applicationId without querying', async () => {
    let queried = false
    const supabase = {
      from: () => {
        queried = true
        return mockSupabase({ data: { id: 'app-1' }, error: null }).from('booth_applications')
      },
    }
    const applied = await applyCoordinatorOpsMutation(supabase, 'evt-1', mutation({
      type: 'check_in',
      payload: { checked_in: true },
    }))
    assert.equal(applied, false)
    assert.equal(queried, false)
  })

  await test('floor_plan_doc_patch is not acknowledged until implemented', async () => {
    const supabase = mockSupabase({ data: { id: 'app-1' }, error: null })
    const applied = await applyCoordinatorOpsMutation(supabase, 'evt-1', mutation({
      type: 'floor_plan_doc_patch',
      payload: { applicationId: 'app-1', doc: {} },
    }))
    assert.equal(applied, false)
  })

  await test('load_in_status fails when booth update errors', async () => {
    const chain = {
      eq: () => chain,
      select: () => chain,
      maybeSingle: async () => ({ data: null, error: { message: 'db error' } }),
      update: () => chain,
    }
    const supabase = { from: () => chain }
    const applied = await applyCoordinatorOpsMutation(supabase, 'evt-1', mutation({
      type: 'load_in_status',
      payload: { applicationId: 'app-1', load_in_status: 'late' },
    }))
    assert.equal(applied, false)
  })

  console.log('ops-sync-apply: all passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
