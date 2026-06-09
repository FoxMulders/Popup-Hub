/**
 * Grant platform operator admin access to bradmulders@gmail.com.
 * Does not promote to coordinator — platform fees settle via Stripe/Square env accounts.
 *
 * Usage: npx tsx scripts/grant-platform-operator.ts
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { PLATFORM_OPERATOR_EMAIL } from '../lib/platform/operator'

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

async function findUserIdByEmail(email: string): Promise<string | null> {
  const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error

    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (match) return match.id

    if (data.users.length < 200) break
    page += 1
  }

  return null
}

async function main() {
  loadEnvLocal()

  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const userId = await findUserIdByEmail(PLATFORM_OPERATOR_EMAIL)
  if (!userId) {
    throw new Error(`No auth user found for ${PLATFORM_OPERATOR_EMAIL}`)
  }

  await supabase.from('profiles').update({ is_admin: false }).eq('is_admin', true)

  const { data: passport } = await supabase
    .from('vendor_passports')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  const role = passport ? 'vendor' : 'shopper'

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update({
      is_admin: true,
      role,
      etransfer_payment_email: null,
    })
    .eq('id', userId)
    .select('id, email, role, is_admin')
    .single()

  if (profileError) {
    throw new Error(`Profile update failed: ${profileError.message}`)
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { role },
  })

  if (authError) {
    throw new Error(`Auth metadata update failed: ${authError.message}`)
  }

  const { error: settingsError } = await supabase.from('platform_settings').upsert(
    {
      id: 1,
      platform_operator_id: userId,
      platform_fee_email: PLATFORM_OPERATOR_EMAIL,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (settingsError) {
    console.warn(`platform_settings upsert skipped: ${settingsError.message}`)
  }

  await supabase.from('wallets').upsert({ user_id: userId }, { onConflict: 'user_id' })

  console.log(`Platform operator admin configured: ${PLATFORM_OPERATOR_EMAIL}`)
  console.log(profile)
  console.log(
    '\nPlatform fees (3% + $1) settle to Popup Hub Stripe/Square accounts — link those dashboards to this email for payouts.'
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
