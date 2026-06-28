import assert from 'node:assert/strict'
import { publishCoordinatorEvent } from '@/lib/coordinator/publish-event'

const baseEvent = {
  id: 'evt-1',
  status: 'draft',
  coordinator_id: 'coord-1',
  latitude: 53.5,
  longitude: -113.5,
  address: '100 Test Ave',
  venue_verified: true,
  venue_verification_status: 'verified',
}

function createMockSupabase(overrides?: {
  rpcError?: string | null
  categoryLimits?: Array<{ price_per_booth: number }>
}) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []

  const supabase = {
    from(table: string) {
      const chain = {
        select() {
          return chain
        },
        eq() {
          return chain
        },
        not() {
          return chain
        },
        limit() {
          return chain
        },
        single() {
          if (table === 'profiles') {
            return Promise.resolve({ data: { coordinator_organization_name: 'Org' }, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        },
        maybeSingle() {
          if (table === 'events') {
            return Promise.resolve({ data: null, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        },
        update() {
          return {
            eq: async () => ({ error: null }),
          }
        },
      }
      return chain
    },
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args })
      if (overrides?.rpcError) {
        return Promise.resolve({ error: { message: overrides.rpcError } })
      }
      return Promise.resolve({ error: null })
    },
    _rpcCalls: rpcCalls,
  }

  if (overrides?.categoryLimits) {
    const originalFrom = supabase.from.bind(supabase)
    supabase.from = (table: string) => {
      if (table === 'event_category_limits') {
        return {
          select() {
            return {
              eq: async () => ({ data: overrides.categoryLimits, error: null }),
            }
          },
        }
      }
      return originalFrom(table)
    }
  }

  return supabase
}

async function testBypassRequiresAssistIdentifiers() {
  const supabase = createMockSupabase({
    categoryLimits: [{ price_per_booth: 0 }],
  })

  const result = await publishCoordinatorEvent(
    supabase as never,
    supabase as never,
    baseEvent,
    { bypassVerificationGate: true }
  )

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 500)
    assert.match(result.error, /request and reviewer identifiers/i)
  }
}

async function testBypassCallsAdminRpc() {
  const supabase = createMockSupabase({
    categoryLimits: [{ price_per_booth: 25 }],
  })

  const result = await publishCoordinatorEvent(
    supabase as never,
    supabase as never,
    baseEvent,
    {
      bypassVerificationGate: true,
      assistRequestId: 'req-1',
      reviewerId: 'admin-1',
    }
  )

  assert.equal(result.ok, true)
  assert.equal(supabase._rpcCalls.length, 1)
  assert.equal(supabase._rpcCalls[0]?.fn, 'admin_publish_assisted_event')
  assert.deepEqual(supabase._rpcCalls[0]?.args, {
    p_request_id: 'req-1',
    p_reviewer_id: 'admin-1',
  })
}

async function run() {
  await testBypassRequiresAssistIdentifiers()
  await testBypassCallsAdminRpc()
  console.log('publish-event: ok')
}

void run()
