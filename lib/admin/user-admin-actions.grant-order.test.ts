/**
 * Sole-admin grant must promote the target before revoking other admins.
 * Run: npx tsx lib/admin/user-admin-actions.grant-order.test.ts
 */
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyAdminUserAction } from '@/lib/admin/user-admin-actions'

type ProfileUpdate = { is_admin?: boolean; role?: string; etransfer_payment_email?: null }

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(
    () => console.log(`  ✓ ${name}`),
    (error) => {
      console.error(`  ✗ ${name}`)
      throw error
    }
  )
}

function createGrantMockDb(options: { grantProfileError?: Error } = {}) {
  const profileUpdates: Array<{ filter: Record<string, unknown>; patch: ProfileUpdate }> = []

  const from = (table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: 'target', email: 'target@example.com', role: 'shopper', full_name: 'Target', is_admin: false },
            }),
            single: async () => ({ data: { is_admin: true } }),
          }),
        }),
        update: (patch: ProfileUpdate) => {
          const filters: Record<string, unknown> = {}
          const chain: {
            eq: (column: string, value: unknown) => typeof chain
            neq: (column: string, value: unknown) => Promise<{ error: Error | null }>
          } = {
            eq: (column: string, value: unknown) => {
              filters[column] = value
              return chain
            },
            neq: (column: string, value: unknown) => {
              filters[column] = `neq:${value}`
              profileUpdates.push({ filter: { ...filters }, patch })
              if (patch.is_admin === true && options.grantProfileError) {
                return Promise.resolve({ error: options.grantProfileError })
              }
              return Promise.resolve({ error: null })
            },
          }

          // Grant path ends with .eq('id', targetUserId) only.
          const grantOnly = {
            eq: (column: string, value: unknown) => {
              filters[column] = value
              profileUpdates.push({ filter: { ...filters }, patch })
              if (patch.is_admin === true && options.grantProfileError) {
                return Promise.resolve({ error: options.grantProfileError })
              }
              return Promise.resolve({ error: null })
            },
          }

          return patch.is_admin === true ? grantOnly : chain
        },
      }
    }

    if (table === 'vendor_passports') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }
    }

    if (table === 'platform_settings') {
      return { upsert: async () => ({ error: null }) }
    }

    if (table === 'wallets') {
      return { upsert: async () => ({ error: null }) }
    }

    throw new Error(`Unexpected table: ${table}`)
  }

  const db = {
    from,
    auth: {
      admin: {
        updateUserById: async () => ({ error: null }),
      },
    },
  } as unknown as SupabaseClient

  return { db, profileUpdates }
}

console.log('setPlatformAdmin grant order')

async function run() {
  await test('promotes target before revoking other admins', async () => {
    const { db, profileUpdates } = createGrantMockDb()

    const result = await applyAdminUserAction(db, 'target', 'acting-admin', {
      action: 'set_admin',
      value: true,
    })

    assert.equal(result.ok, true)
    assert.equal(profileUpdates.length, 2)
    assert.equal(profileUpdates[0]?.patch.is_admin, true)
    assert.equal(profileUpdates[0]?.filter.id, 'target')
    assert.equal(profileUpdates[1]?.patch.is_admin, false)
    assert.equal(profileUpdates[1]?.filter.id, 'neq:target')
  })

  await test('does not revoke existing admins when grant fails', async () => {
    const { db, profileUpdates } = createGrantMockDb({
      grantProfileError: new Error('grant failed'),
    })

    const result = await applyAdminUserAction(db, 'target', 'acting-admin', {
      action: 'set_admin',
      value: true,
    })

    assert.equal(result.ok, false)
    assert.equal(profileUpdates.length, 1)
    assert.equal(profileUpdates[0]?.patch.is_admin, true)
  })

  console.log('\nAll grant-order tests passed.')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
