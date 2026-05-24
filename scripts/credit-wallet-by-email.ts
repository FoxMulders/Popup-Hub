/**
 * Credit a user's wallet by email (service role required).
 *
 * Usage:
 *   npx tsx scripts/credit-wallet-by-email.ts muldersbrad@gmail.com 10
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { creditWalletDeposit } from '../lib/wallet/credit-deposit'

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
    // optional when vars are exported
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  const dollars = Number(process.argv[3] ?? '10')
  if (!email) {
    console.error('Usage: npx tsx scripts/credit-wallet-by-email.ts <email> [dollars]')
    process.exit(1)
  }
  if (!Number.isFinite(dollars) || dollars <= 0) {
    console.error('Amount must be a positive number of dollars')
    process.exit(1)
  }

  loadEnvLocal()
  const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle()

  if (profileError || !profile?.id) {
    console.error(`No profile found for ${email}`)
    process.exit(1)
  }

  const amountCents = Math.round(dollars * 100)
  const result = await creditWalletDeposit(supabase, {
    userId: profile.id,
    amountCents,
    metadata: {
      source: 'admin_credit',
      note: `Manual ${dollars.toFixed(2)} USD credit for testing`,
    },
    transactionType: 'deposit',
  })

  if (!result.ok) {
    console.error(`Credit failed: ${result.error}`)
    process.exit(1)
  }

  console.log(
    `Credited $${dollars.toFixed(2)} to ${email} — new balance $${(result.newBalance / 100).toFixed(2)}`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
