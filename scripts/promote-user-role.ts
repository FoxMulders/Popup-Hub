/**
 * Promote a user to vendor (or other role) via service role.
 *
 * Usage:
 *   npx tsx scripts/promote-user-role.ts thetipsyfoxyeg@gmail.com vendor
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Role } from '../types/database'

type ServiceClient = SupabaseClient<any>

function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local')
  try {
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // optional when vars are exported
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
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

async function main() {
  const email = process.argv[2]
  const role = (process.argv[3] ?? 'vendor') as Role

  if (!email) {
    throw new Error('Usage: npx tsx scripts/promote-user-role.ts <email> [role]')
  }

  if (!['shopper', 'vendor', 'coordinator'].includes(role)) {
    throw new Error(`Invalid role: ${role}`)
  }

  loadEnvLocal()

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const userId = await findUserIdByEmail(supabase.auth.admin, email)
  if (!userId) {
    throw new Error(`No auth user found for ${email}`)
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)

  if (profileError) {
    throw new Error(`Profile update failed: ${profileError.message}`)
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { role },
  })

  if (authError) {
    throw new Error(`Auth metadata update failed: ${authError.message}`)
  }

  await supabase.from('wallets').upsert({ user_id: userId }, { onConflict: 'user_id' })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, full_name')
    .eq('id', userId)
    .single()

  console.log(`Promoted ${email} → ${role}`)
  console.log(profile)
  console.log('\nUser can sign in and land on /vendor/dashboard on next session.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
