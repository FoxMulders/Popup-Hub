import type { SupabaseClient } from '@supabase/supabase-js'
import type { Role } from '@/types/database'
import {
  findDuplicateDeletionBlockers,
  findDuplicateProfilesByEmail,
  type DuplicateProfileSummary,
} from '@/lib/auth/duplicate-account'
import { identityProviderLabel } from '@/lib/auth/connected-identities'

export interface AdminLinkedProvider {
  provider: string
  label: string
  created_at: string | null
}

export interface AdminUserDetail {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  is_admin: boolean
  is_beta_tester: boolean
  platform_wallet_blocked: boolean
  created_at: string
  updated_at: string
  coordinator_verification_status: string | null
  coordinator_account_status: string | null
  coordinator_organization_name: string | null
  coordinator_is_verified: boolean
  reliability_score: number
  total_markets: number
  no_show_count: number
  walletBalanceCents: number
  walletPaddleId: string | null
  vendorBusinessName: string | null
  ownedEventCount: number
  linkedProviders: AdminLinkedProvider[]
  duplicateEmailProfiles: DuplicateProfileSummary[]
  auth: {
    emailConfirmedAt: string | null
    lastSignInAt: string | null
    isBanned: boolean
  }
}

async function fetchLinkedProviders(
  db: SupabaseClient,
  userId: string
): Promise<AdminLinkedProvider[]> {
  const { data, error } = await db
    .schema('auth')
    .from('identities')
    .select('provider, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[admin user-detail] identity lookup failed:', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    provider: row.provider as string,
    label: identityProviderLabel(row.provider as string),
    created_at: (row.created_at as string | null) ?? null,
  }))
}

export async function fetchAdminUserDetail(
  db: SupabaseClient,
  userId: string
): Promise<AdminUserDetail | null> {
  const { data: profile } = await db
    .from('profiles')
    .select(
      `
      id,
      email,
      full_name,
      role,
      is_admin,
      is_beta_tester,
      platform_wallet_blocked,
      created_at,
      updated_at,
      coordinator_verification_status,
      coordinator_account_status,
      coordinator_organization_name,
      coordinator_is_verified,
      reliability_score,
      total_markets,
      no_show_count
    `
    )
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return null

  const email = profile.email as string | null

  const [
    { data: wallet },
    { count: ownedEventCount },
    { data: passport },
    authResult,
    linkedProviders,
    duplicateEmailProfiles,
  ] = await Promise.all([
    db.from('wallets').select('balance, paddle_id').eq('user_id', userId).maybeSingle(),
    db
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('coordinator_id', userId),
    db.from('vendor_passports').select('business_name').eq('user_id', userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
    fetchLinkedProviders(db, userId),
    email ? findDuplicateProfilesByEmail(db, email, userId) : Promise.resolve([]),
  ])

  const authUser = authResult.data.user
  const bannedUntil = authUser?.banned_until
  const isBanned =
    !!bannedUntil && bannedUntil !== 'none' && new Date(bannedUntil) > new Date()

  return {
    id: profile.id as string,
    email,
    full_name: profile.full_name as string | null,
    role: profile.role as Role,
    is_admin: profile.is_admin === true,
    is_beta_tester: profile.is_beta_tester === true,
    platform_wallet_blocked: profile.platform_wallet_blocked === true,
    created_at: profile.created_at as string,
    updated_at: profile.updated_at as string,
    coordinator_verification_status:
      (profile.coordinator_verification_status as string | null) ?? null,
    coordinator_account_status: (profile.coordinator_account_status as string | null) ?? null,
    coordinator_organization_name:
      (profile.coordinator_organization_name as string | null) ?? null,
    coordinator_is_verified: profile.coordinator_is_verified === true,
    reliability_score: (profile.reliability_score as number) ?? 0,
    total_markets: (profile.total_markets as number) ?? 0,
    no_show_count: (profile.no_show_count as number) ?? 0,
    walletBalanceCents: (wallet?.balance as number) ?? 0,
    walletPaddleId: (wallet?.paddle_id as string | null) ?? null,
    vendorBusinessName: (passport?.business_name as string | null) ?? null,
    ownedEventCount: ownedEventCount ?? 0,
    linkedProviders,
    duplicateEmailProfiles,
    auth: {
      emailConfirmedAt: authUser?.email_confirmed_at ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      isBanned,
    },
  }
}

export async function canSafelyDeleteDuplicateAccount(
  db: SupabaseClient,
  duplicateUserId: string,
  keepUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (duplicateUserId === keepUserId) {
    return { ok: false, error: 'Cannot resolve an account with itself' }
  }

  const [{ data: duplicateProfile }, { data: keepProfile }] = await Promise.all([
    db
      .from('profiles')
      .select('id, email, is_admin')
      .eq('id', duplicateUserId)
      .maybeSingle(),
    db
      .from('profiles')
      .select('id, email')
      .eq('id', keepUserId)
      .maybeSingle(),
  ])

  if (!duplicateProfile) {
    return { ok: false, error: 'Duplicate account not found' }
  }
  if (!keepProfile) {
    return { ok: false, error: 'Account to keep was not found' }
  }

  const duplicateEmail = (duplicateProfile.email as string | null)?.trim().toLowerCase() ?? ''
  const keepEmail = (keepProfile.email as string | null)?.trim().toLowerCase() ?? ''

  if (!duplicateEmail || duplicateEmail !== keepEmail) {
    return {
      ok: false,
      error: 'Both accounts must share the same email address to resolve as duplicates',
    }
  }

  const blockers = await findDuplicateDeletionBlockers(db, duplicateUserId)
  if (blockers.length > 0) {
    return { ok: false, error: blockers.map((blocker) => blocker.message).join(' ') }
  }

  return { ok: true }
}
