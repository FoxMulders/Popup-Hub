import type { SupabaseClient } from '@supabase/supabase-js'
import { PLATFORM_OPERATOR_EMAIL, PLATFORM_SQUARE_OPERATOR_EMAIL } from '@/lib/platform/operator'
import type { Role } from '@/types/database'

export type AdminUserAction =
  | { action: 'set_role'; role: Role }
  | { action: 'set_beta_tester'; value: boolean }
  | { action: 'set_wallet_blocked'; value: boolean }
  | { action: 'set_admin'; value: boolean }
  | { action: 'send_password_reset' }
  | { action: 'ban_auth' }
  | { action: 'unban_auth' }

export type AdminUserActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; status: number }

const VALID_ROLES: Role[] = ['shopper', 'vendor', 'coordinator']

export async function applyAdminUserAction(
  db: SupabaseClient,
  targetUserId: string,
  actingAdminId: string | null,
  payload: AdminUserAction
): Promise<AdminUserActionResult> {
  const { data: targetProfile } = await db
    .from('profiles')
    .select('id, email, role, full_name, is_admin')
    .eq('id', targetUserId)
    .maybeSingle()

  if (!targetProfile) {
    return { ok: false, error: 'User not found', status: 404 }
  }

  switch (payload.action) {
    case 'set_role':
      return setUserRole(db, targetUserId, targetProfile, payload.role)
    case 'set_beta_tester':
      return setBetaTester(db, targetUserId, payload.value)
    case 'set_wallet_blocked':
      return setWalletBlocked(db, targetUserId, payload.value)
    case 'set_admin':
      return setPlatformAdmin(db, targetUserId, targetProfile, actingAdminId, payload.value)
    case 'send_password_reset':
      return sendPasswordReset(db, targetProfile.email)
    case 'ban_auth':
      return banAuthUser(db, targetUserId, targetProfile.is_admin === true)
    case 'unban_auth':
      return unbanAuthUser(db, targetUserId)
    default:
      return { ok: false, error: 'Invalid action', status: 400 }
  }
}

async function setUserRole(
  db: SupabaseClient,
  userId: string,
  profile: { full_name: string | null },
  role: Role
): Promise<AdminUserActionResult> {
  if (!VALID_ROLES.includes(role)) {
    return { ok: false, error: 'Invalid role', status: 400 }
  }

  const { error: profileError } = await db.from('profiles').update({ role }).eq('id', userId)

  if (profileError) {
    return { ok: false, error: profileError.message, status: 500 }
  }

  const { error: authError } = await db.auth.admin.updateUserById(userId, {
    user_metadata: { role },
  })

  if (authError) {
    return { ok: false, error: authError.message, status: 500 }
  }

  await db.from('wallets').upsert({ user_id: userId }, { onConflict: 'user_id' })

  if (role === 'vendor' || role === 'coordinator') {
    await db.from('vendor_passports').upsert(
      {
        user_id: userId,
        business_name: profile.full_name ?? '',
      },
      { onConflict: 'user_id' }
    )
  }

  return { ok: true, message: `Role updated to ${role}` }
}

async function setBetaTester(
  db: SupabaseClient,
  userId: string,
  value: boolean
): Promise<AdminUserActionResult> {
  const { error } = await db
    .from('profiles')
    .update({ is_beta_tester: value })
    .eq('id', userId)

  if (error) {
    return { ok: false, error: error.message, status: 500 }
  }

  return { ok: true, message: value ? 'Beta tester enabled' : 'Beta tester disabled' }
}

async function setWalletBlocked(
  db: SupabaseClient,
  userId: string,
  value: boolean
): Promise<AdminUserActionResult> {
  const updates = value
    ? { platform_wallet_blocked: true }
    : { platform_wallet_blocked: false, platform_wallet_grace_until: null }

  const { error } = await db.from('profiles').update(updates).eq('id', userId)

  if (error) {
    return { ok: false, error: error.message, status: 500 }
  }

  return {
    ok: true,
    message: value ? 'Platform wallet blocked' : 'Platform wallet unblocked',
  }
}

async function setPlatformAdmin(
  db: SupabaseClient,
  targetUserId: string,
  targetProfile: { email: string | null; is_admin: boolean | null },
  actingAdminId: string | null,
  grant: boolean
): Promise<AdminUserActionResult> {
  if (!grant) {
    if (targetProfile.is_admin && actingAdminId === targetUserId) {
      const { count } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_admin', true)

      if ((count ?? 0) <= 1) {
        return {
          ok: false,
          error: 'Cannot revoke your own admin access while you are the sole platform admin',
          status: 409,
        }
      }
    }

    const { error } = await db
      .from('profiles')
      .update({ is_admin: false })
      .eq('id', targetUserId)

    if (error) {
      return { ok: false, error: error.message, status: 500 }
    }

    return { ok: true, message: 'Platform admin access revoked' }
  }

  const { data: passport } = await db
    .from('vendor_passports')
    .select('id')
    .eq('user_id', targetUserId)
    .maybeSingle()

  const role: Role = passport ? 'vendor' : 'shopper'

  const { error: profileError } = await db
    .from('profiles')
    .update({
      is_admin: true,
      role,
      etransfer_payment_email: null,
    })
    .eq('id', targetUserId)

  if (profileError) {
    return { ok: false, error: profileError.message, status: 500 }
  }

  const { error: revokeError } = await db
    .from('profiles')
    .update({ is_admin: false })
    .eq('is_admin', true)
    .neq('id', targetUserId)

  if (revokeError) {
    return { ok: false, error: revokeError.message, status: 500 }
  }

  const { error: authError } = await db.auth.admin.updateUserById(targetUserId, {
    user_metadata: { role },
  })

  if (authError) {
    return { ok: false, error: authError.message, status: 500 }
  }

  const adminEmail = targetProfile.email ?? PLATFORM_OPERATOR_EMAIL

  await db.from('platform_settings').upsert(
    {
      id: 1,
      platform_operator_id: targetUserId,
      platform_fee_email: adminEmail,
      platform_square_email: PLATFORM_SQUARE_OPERATOR_EMAIL,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  await db.from('wallets').upsert({ user_id: targetUserId }, { onConflict: 'user_id' })

  return { ok: true, message: 'Platform admin access granted (sole admin policy applied)' }
}

async function sendPasswordReset(
  db: SupabaseClient,
  email: string | null
): Promise<AdminUserActionResult> {
  if (!email) {
    return { ok: false, error: 'User has no email address', status: 400 }
  }

  const { error } = await db.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  if (error) {
    return { ok: false, error: error.message, status: 500 }
  }

  return { ok: true, message: 'Password reset email sent' }
}

async function banAuthUser(
  db: SupabaseClient,
  userId: string,
  isAdmin: boolean
): Promise<AdminUserActionResult> {
  if (isAdmin) {
    return { ok: false, error: 'Cannot ban a platform admin account', status: 409 }
  }

  const { error } = await db.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  })

  if (error) {
    return { ok: false, error: error.message, status: 500 }
  }

  return { ok: true, message: 'Auth account banned' }
}

async function unbanAuthUser(
  db: SupabaseClient,
  userId: string
): Promise<AdminUserActionResult> {
  const { error } = await db.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })

  if (error) {
    return { ok: false, error: error.message, status: 500 }
  }

  return { ok: true, message: 'Auth account unbanned' }
}

export function parseAdminUserAction(body: unknown): AdminUserAction | null {
  if (!body || typeof body !== 'object') return null

  const record = body as Record<string, unknown>
  const action = record.action

  if (action === 'set_role' && typeof record.role === 'string') {
    return { action: 'set_role', role: record.role as Role }
  }
  if (action === 'set_beta_tester' && typeof record.value === 'boolean') {
    return { action: 'set_beta_tester', value: record.value }
  }
  if (action === 'set_wallet_blocked' && typeof record.value === 'boolean') {
    return { action: 'set_wallet_blocked', value: record.value }
  }
  if (action === 'set_admin' && typeof record.value === 'boolean') {
    return { action: 'set_admin', value: record.value }
  }
  if (action === 'send_password_reset') {
    return { action: 'send_password_reset' }
  }
  if (action === 'ban_auth') {
    return { action: 'ban_auth' }
  }
  if (action === 'unban_auth') {
    return { action: 'unban_auth' }
  }

  return null
}
