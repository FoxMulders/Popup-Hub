/**
 * Seeds pre-verified local test users via Supabase Auth Admin API.
 *
 * Usage:
 *   npm run seed:test-users
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY (sign-in verification only)
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Role } from '../types/database'
import { seedWorkflowFixtures } from './seed-workflow-fixtures'

type ServiceClient = SupabaseClient<any>

type TestAccount = {
  email: string
  password: string
  role: Role
  fullName: string
}

const TEST_ACCOUNTS: TestAccount[] = [
  {
    email: 'coordinator@me.com',
    password: 'testing',
    role: 'coordinator',
    fullName: 'Test Coordinator',
  },
  {
    email: 'vendor@me.com',
    password: 'testing',
    role: 'vendor',
    fullName: 'Test Vendor',
  },
  {
    email: 'patron@me.com',
    password: 'testing',
    role: 'shopper',
    fullName: 'Test Patron',
  },
]

function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local')
  try {
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator === -1) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim()
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  } catch {
    // .env.local is optional when vars are already exported
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local or export it before running.`)
  }
  return value
}

async function findUserIdByEmail(
  admin: ServiceClient['auth']['admin'],
  email: string
): Promise<string | null> {
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await admin.listUsers({ page, perPage })
    if (error) throw error

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    )
    if (match) return match.id

    if (data.users.length < perPage) break
    page += 1
  }

  return null
}

async function upsertVerifiedUser(
  admin: ServiceClient['auth']['admin'],
  account: TestAccount
): Promise<string> {
  const existingId = await findUserIdByEmail(admin, account.email)

  if (existingId) {
    const { data, error } = await admin.updateUserById(existingId, {
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        role: account.role,
        full_name: account.fullName,
      },
    })
    if (error) throw new Error(`update ${account.email}: ${error.message}`)
    return data.user.id
  }

  const { data, error } = await admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      role: account.role,
      full_name: account.fullName,
    },
  })
  if (error) throw new Error(`create ${account.email}: ${error.message}`)
  return data.user.id
}

async function syncProfile(
  supabase: ServiceClient,
  userId: string,
  account: TestAccount
) {
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email: account.email,
      role: account.role,
      full_name: account.fullName,
    },
    { onConflict: 'id' }
  )
  if (profileError) {
    throw new Error(`profile ${account.email}: ${profileError.message}`)
  }

  const { error: walletError } = await supabase.from('wallets').upsert(
    { user_id: userId },
    { onConflict: 'user_id' }
  )
  if (walletError) {
    throw new Error(`wallet ${account.email}: ${walletError.message}`)
  }
}

async function verifyPasswordSignIn(email: string, password: string) {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  const body = (await res.json()) as { error_description?: string; user?: { email?: string } }
  if (!res.ok) {
    throw new Error(
      `sign-in ${email}: ${body.error_description ?? JSON.stringify(body)}`
    )
  }
}

async function linkVendorApproval(
  supabase: ServiceClient,
  coordinatorId: string,
  vendorId: string
) {
  const { error } = await supabase.from('coordinator_vendor_approvals').upsert(
    {
      coordinator_id: coordinatorId,
      vendor_user_id: vendorId,
    },
    { onConflict: 'coordinator_id,vendor_user_id' }
  )

  if (error) {
    throw new Error(`vendor approval link: ${error.message}`)
  }
}

async function main() {
  loadEnvLocal()

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const ids: Partial<Record<Role, string>> = {}

  console.log('Seeding pre-verified test users…')

  for (const account of TEST_ACCOUNTS) {
    const userId = await upsertVerifiedUser(supabase.auth.admin, account)
    await syncProfile(supabase, userId, account)
    await verifyPasswordSignIn(account.email, account.password)
    ids[account.role] = userId

    console.log(`  ✓ ${account.role.padEnd(11)} ${account.email}`)
  }

  if (ids.coordinator && ids.vendor) {
    await linkVendorApproval(supabase, ids.coordinator, ids.vendor)
    console.log('  ✓ linked vendor@me.com → coordinator@me.com approval')

    const fixtures = await seedWorkflowFixtures(supabase, ids.coordinator, ids.vendor)
    console.log(`  ✓ vendor passport (${fixtures.categoryName})`)
    console.log(`  ✓ draft market "${fixtures.draftEventName}" (${fixtures.draftEventId})`)
    console.log('  ✓ workflow fixtures → tests/e2e/workflow/.fixtures.json')
  }

  console.log('\nDone. All accounts use password: testing')
  console.log('Sign in at http://localhost:3000/login')
  console.log('Full workflow QA: npm run qa:workflow')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
