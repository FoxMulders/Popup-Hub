import type { SupabaseClient } from '@supabase/supabase-js'

export type DuplicateProfileSummary = {
  id: string
  full_name: string | null
  email: string | null
  role: string
  is_admin: boolean
  created_at: string
}

export async function findDuplicateProfilesByEmail(
  db: SupabaseClient,
  email: string,
  excludeUserId: string
): Promise<DuplicateProfileSummary[]> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return []

  const { data, error } = await db
    .from('profiles')
    .select('id, full_name, email, role, is_admin, created_at')
    .neq('id', excludeUserId)
    .ilike('email', normalized)

  if (error) {
    console.error('[duplicate-account] profile lookup failed:', error.message)
    return []
  }

  return (data ?? []) as DuplicateProfileSummary[]
}

export type DuplicateDeletionBlocker = {
  code: 'owned_events' | 'wallet_balance' | 'booth_applications' | 'is_admin' | 'platform_operator'
  message: string
}

export async function findDuplicateDeletionBlockers(
  db: SupabaseClient,
  duplicateUserId: string
): Promise<DuplicateDeletionBlocker[]> {
  const blockers: DuplicateDeletionBlocker[] = []

  const [
    { data: profile },
    { count: ownedEventCount },
    { data: wallet },
    { count: applicationCount },
    { data: platformSettings },
  ] = await Promise.all([
    db.from('profiles').select('is_admin').eq('id', duplicateUserId).maybeSingle(),
    db
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('coordinator_id', duplicateUserId),
    db.from('wallets').select('balance').eq('user_id', duplicateUserId).maybeSingle(),
    db
      .from('booth_applications')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', duplicateUserId),
    db.from('platform_settings').select('platform_operator_id').eq('id', 1).maybeSingle(),
  ])

  if (profile?.is_admin === true) {
    blockers.push({
      code: 'is_admin',
      message: 'Cannot delete a platform admin account. Revoke admin first or keep this account.',
    })
  }

  if (platformSettings?.platform_operator_id === duplicateUserId) {
    blockers.push({
      code: 'platform_operator',
      message: 'This account is the platform operator and cannot be deleted.',
    })
  }

  if ((ownedEventCount ?? 0) > 0) {
    blockers.push({
      code: 'owned_events',
      message: `Account owns ${ownedEventCount} market(s). Merge data manually before deleting.`,
    })
  }

  const balance = (wallet?.balance as number | undefined) ?? 0
  if (balance !== 0) {
    blockers.push({
      code: 'wallet_balance',
      message: `Wallet balance is ${(balance / 100).toFixed(2)}. Settle or transfer funds first.`,
    })
  }

  if ((applicationCount ?? 0) > 0) {
    blockers.push({
      code: 'booth_applications',
      message: `Account has ${applicationCount} booth application(s). Resolve these before deleting.`,
    })
  }

  return blockers
}
