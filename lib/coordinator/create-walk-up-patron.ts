import type { SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { ensureWallet } from '@/lib/wallet/credit-deposit'

export async function createWalkUpPatron(
  admin: SupabaseClient,
  input: { fullName: string; email?: string | null }
): Promise<
  | { ok: true; userId: string; fullName: string; email: string; walletNumber: string | null }
  | { ok: false; error: string }
> {
  const fullName = input.fullName.trim()
  if (fullName.length < 2) {
    return { ok: false, error: 'Enter the patron’s name (at least 2 characters).' }
  }

  const email =
    input.email?.trim() ||
    `walkup.${randomBytes(6).toString('hex')}@door.popuphub.local`

  const password = randomBytes(16).toString('base64url')

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'shopper',
      full_name: fullName,
    },
  })

  if (error || !created.user) {
    return { ok: false, error: error?.message ?? 'Could not create walk-up account' }
  }

  const userId = created.user.id

  await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      role: 'shopper',
      full_name: fullName,
    },
    { onConflict: 'id' }
  )

  const wallet = await ensureWallet(admin, userId)
  if (wallet && !wallet.paddle_id) {
    const paddleId = Math.floor(1000 + Math.random() * 9000).toString()
    await admin.from('wallets').update({ paddle_id: paddleId }).eq('id', wallet.id)
    wallet.paddle_id = paddleId
  }

  return {
    ok: true,
    userId,
    fullName,
    email,
    walletNumber: wallet?.paddle_id ?? null,
  }
}
