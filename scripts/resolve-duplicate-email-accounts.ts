/**
 * Find and optionally delete empty duplicate profiles that share the same email.
 *
 * Keeps the profile with is_admin=true, otherwise the earliest created_at.
 * Only deletes duplicates that pass the same safety checks as admin resolve_duplicate.
 *
 * Usage:
 *   npx tsx scripts/resolve-duplicate-email-accounts.ts          # dry run
 *   npx tsx scripts/resolve-duplicate-email-accounts.ts --apply # delete safe duplicates
 *   npx tsx scripts/resolve-duplicate-email-accounts.ts --email bradmulders@gmail.com
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  canSafelyDeleteDuplicateAccount,
} from '../lib/admin/user-detail'
import { findDuplicateDeletionBlockers } from '../lib/auth/duplicate-account'

type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  role: string
  is_admin: boolean
  created_at: string
}

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

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply')
  const emailIndex = argv.indexOf('--email')
  const email =
    emailIndex >= 0 && argv[emailIndex + 1] ? argv[emailIndex + 1].trim().toLowerCase() : null
  return { apply, email }
}

function pickKeeper(profiles: ProfileRow[]): ProfileRow {
  return [...profiles].sort((a, b) => {
    if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })[0]
}

async function loadProfiles(supabase: SupabaseClient, emailFilter: string | null) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_admin, created_at')
    .not('email', 'is', null)
    .neq('email', '')

  if (error) throw error

  const rows = (data ?? []) as ProfileRow[]
  const filtered = emailFilter
    ? rows.filter((row) => row.email.trim().toLowerCase() === emailFilter)
    : rows

  const groups = new Map<string, ProfileRow[]>()
  for (const row of filtered) {
    const key = row.email.trim().toLowerCase()
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  return [...groups.entries()].filter(([, profiles]) => profiles.length > 1)
}

async function main() {
  loadEnvLocal()
  const { apply, email } = parseArgs(process.argv.slice(2))

  const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const duplicateGroups = await loadProfiles(supabase, email)

  if (duplicateGroups.length === 0) {
    console.log(email ? `No duplicate profiles found for ${email}.` : 'No duplicate email profiles found.')
    return
  }

  console.log(`${apply ? 'APPLY' : 'DRY RUN'} — ${duplicateGroups.length} duplicate email group(s)\n`)

  for (const [normalizedEmail, profiles] of duplicateGroups) {
    const keeper = pickKeeper(profiles)
    const duplicates = profiles.filter((profile) => profile.id !== keeper.id)

    console.log(`Email: ${normalizedEmail}`)
    console.log(
      `  Keep: ${keeper.full_name || keeper.id} (${keeper.id}) role=${keeper.role} admin=${keeper.is_admin}`
    )

    for (const duplicate of duplicates) {
      const blockers = await findDuplicateDeletionBlockers(supabase, duplicate.id)
      const safety = await canSafelyDeleteDuplicateAccount(supabase, duplicate.id, keeper.id)

      console.log(
        `  Duplicate: ${duplicate.full_name || duplicate.id} (${duplicate.id}) role=${duplicate.role} admin=${duplicate.is_admin}`
      )

      if (!safety.ok) {
        console.log(`    SKIP: ${safety.error}`)
        continue
      }

      if (blockers.length > 0) {
        console.log(`    SKIP: ${blockers.map((blocker) => blocker.message).join(' ')}`)
        continue
      }

      if (apply) {
        const { error } = await supabase.auth.admin.deleteUser(duplicate.id)
        if (error) {
          console.log(`    FAILED: ${error.message}`)
        } else {
          console.log('    DELETED')
        }
      } else {
        console.log('    Would delete (run with --apply to execute)')
      }
    }

    console.log('')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
