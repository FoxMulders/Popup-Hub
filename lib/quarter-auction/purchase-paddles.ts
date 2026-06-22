import type { SupabaseClient } from '@supabase/supabase-js'
import { adjustWalletBalance } from '@/lib/wallet/adjust-balance'
import { creditsToCents } from '@/lib/quarter-auction/credits'
import {
  clampPoolSize,
  formatPaddleNumber,
  parsePaddleNumber,
} from '@/lib/quarter-auction/paddle-pool'
import type { EventPaddle } from '@/types/database'

export async function fetchTakenPaddleNumbers(
  supabase: SupabaseClient,
  eventId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from('event_paddles')
    .select('paddle_number')
    .eq('event_id', eventId)

  return new Set((data ?? []).map((row) => row.paddle_number))
}

export async function purchaseEventPaddles(
  supabase: SupabaseClient,
  params: {
    eventId: string
    userId: string
    rawNumbers: (string | number)[]
    creditsPerPaddle: number
    poolSize: number
  }
): Promise<
  | { ok: true; paddles: EventPaddle[]; newBalance: number }
  | { ok: false; error: string; conflictNumbers?: string[] }
> {
  const poolSize = clampPoolSize(params.poolSize)
  const creditsPerPaddle = params.creditsPerPaddle

  if (creditsPerPaddle < 1) {
    return { ok: false, error: 'Invalid paddle price' }
  }

  const parsed: number[] = []
  for (const raw of params.rawNumbers) {
    const n = parsePaddleNumber(raw, poolSize)
    if (n == null) {
      return { ok: false, error: `Invalid paddle number: ${raw}` }
    }
    parsed.push(n)
  }

  const unique = [...new Set(parsed)]
  if (unique.length === 0) {
    return { ok: false, error: 'Select at least one paddle number' }
  }
  if (unique.length !== parsed.length) {
    return { ok: false, error: 'Duplicate numbers in your selection' }
  }

  const taken = await fetchTakenPaddleNumbers(supabase, params.eventId)
  const conflictNumbers = unique
    .map((n) => formatPaddleNumber(n, poolSize))
    .filter((label) => taken.has(label))

  if (conflictNumbers.length > 0) {
    return {
      ok: false,
      error: `Paddle number${conflictNumbers.length === 1 ? '' : 's'} already taken: ${conflictNumbers.join(', ')}`,
      conflictNumbers,
    }
  }

  const totalCredits = unique.length * creditsPerPaddle
  const totalCents = creditsToCents(totalCredits)

  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance')
    .eq('user_id', params.userId)
    .single()

  if (!wallet) {
    return { ok: false, error: 'Wallet not found' }
  }
  if (wallet.balance < totalCents) {
    return { ok: false, error: 'Insufficient wallet balance' }
  }

  const newBalance = wallet.balance - totalCents
  const { error: walletError } = await supabase
    .from('wallets')
    .update({ balance: newBalance })
    .eq('id', wallet.id)
    .eq('balance', wallet.balance)

  if (walletError) {
    return { ok: false, error: 'Could not deduct quarters — please retry' }
  }

  const rows = unique.map((n) => ({
    event_id: params.eventId,
    user_id: params.userId,
    paddle_number: formatPaddleNumber(n, poolSize),
    purchase_credits: creditsPerPaddle,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('event_paddles')
    .insert(rows)
    .select('*')

  if (insertError || !inserted?.length) {
    const refund = await adjustWalletBalance(supabase, {
      walletId: wallet.id,
      deltaCents: totalCents,
    })
    if (!refund.ok) {
      console.error('[purchaseEventPaddles] refund failed after paddle insert error', {
        eventId: params.eventId,
        userId: params.userId,
        refundError: refund.error,
        insertError: insertError?.message,
      })
      return {
        ok: false,
        error: 'Could not register paddles — refund pending, contact support if balance looks wrong',
      }
    }

    if (insertError?.code === '23505') {
      return { ok: false, error: 'One or more paddle numbers were just taken — refresh and try again' }
    }
    return { ok: false, error: insertError?.message ?? 'Could not register paddles' }
  }

  await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    type: 'paddle_purchase',
    amount: totalCents,
    metadata: {
      event_id: params.eventId,
      kind: 'virtual_paddle',
      paddle_numbers: inserted.map((p) => p.paddle_number),
      count: inserted.length,
    },
  })

  return { ok: true, paddles: inserted as EventPaddle[], newBalance }
}
