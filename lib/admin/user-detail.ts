import type { SupabaseClient } from '@supabase/supabase-js'
import type { Role } from '@/types/database'

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
  auth: {
    emailConfirmedAt: string | null
    lastSignInAt: string | null
    isBanned: boolean
  }
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

  const [{ data: wallet }, { count: ownedEventCount }, { data: passport }, authResult] =
    await Promise.all([
      db.from('wallets').select('balance, paddle_id').eq('user_id', userId).maybeSingle(),
      db
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('coordinator_id', userId),
      db.from('vendor_passports').select('business_name').eq('user_id', userId).maybeSingle(),
      db.auth.admin.getUserById(userId),
    ])

  const authUser = authResult.data.user
  const bannedUntil = authUser?.banned_until
  const isBanned =
    !!bannedUntil && bannedUntil !== 'none' && new Date(bannedUntil) > new Date()

  return {
    id: profile.id as string,
    email: profile.email as string | null,
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
    auth: {
      emailConfirmedAt: authUser?.email_confirmed_at ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      isBanned,
    },
  }
}
