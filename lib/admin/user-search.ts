import type { SupabaseClient } from '@supabase/supabase-js'
import { parseWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'
import { normalizeWalletPaddleIdQuery } from '@/lib/wallet/paddle-id'
import type { Role } from '@/types/database'

export interface AdminUserSearchResult {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  is_admin: boolean
  is_beta_tester: boolean
  created_at: string
  coordinator_verification_status: string | null
  coordinator_account_status: string | null
}

const MAX_QUERY_LENGTH = 120
const MAX_RESULTS = 12
const UUID_RE =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

function normalizeQuery(raw: string): string {
  return raw.trim().slice(0, MAX_QUERY_LENGTH)
}

export async function searchAdminUsers(
  supabase: SupabaseClient,
  rawQuery: string
): Promise<AdminUserSearchResult[]> {
  const query = normalizeQuery(rawQuery)
  if (query.length < 2) return []

  const userIds = new Set<string>()

  const parsedUuid = parseWalletTopUpQrPayload(query)
  if (parsedUuid) userIds.add(parsedUuid)

  if (UUID_RE.test(query)) {
    userIds.add(query)
  }

  const paddleId = normalizeWalletPaddleIdQuery(query)
  if (paddleId) {
    const { data: walletRows } = await supabase
      .from('wallets')
      .select('user_id')
      .eq('paddle_id', paddleId)
    for (const row of walletRows ?? []) {
      if (row.user_id) userIds.add(row.user_id as string)
    }
  } else {
    const hexSuffix = query.replace(/^#+/, '').replace(/^P-?/i, '')
    if (/^[A-F0-9]{4,8}$/i.test(hexSuffix)) {
      const { data: walletRows } = await supabase
        .from('wallets')
        .select('user_id')
        .ilike('paddle_id', `P-%${hexSuffix.toUpperCase()}%`)
        .limit(MAX_RESULTS)
      for (const row of walletRows ?? []) {
        if (row.user_id) userIds.add(row.user_id as string)
      }
    }
  }

  if (userIds.size < MAX_RESULTS) {
    const pattern = `%${query.replace(/[%_,]/g, '')}%`
    const { data: profileMatches } = await supabase
      .from('profiles')
      .select('id')
      .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(MAX_RESULTS)

    for (const row of profileMatches ?? []) {
      userIds.add(row.id as string)
    }
  }

  if (userIds.size === 0) return []

  const ids = [...userIds].slice(0, MAX_RESULTS)
  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, role, is_admin, is_beta_tester, created_at, coordinator_verification_status, coordinator_account_status'
    )
    .in('id', ids)

  return (profiles ?? [])
    .map((profile) => ({
      id: profile.id as string,
      email: profile.email as string | null,
      full_name: profile.full_name as string | null,
      role: profile.role as Role,
      is_admin: profile.is_admin === true,
      is_beta_tester: profile.is_beta_tester === true,
      created_at: profile.created_at as string,
      coordinator_verification_status: (profile.coordinator_verification_status as string | null) ?? null,
      coordinator_account_status: (profile.coordinator_account_status as string | null) ?? null,
    }))
    .sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? ''))
}
