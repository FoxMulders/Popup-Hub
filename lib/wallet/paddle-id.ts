import type { SupabaseClient } from '@supabase/supabase-js'

/** Matches DB default: P- + 8 uppercase hex chars from UUID. */
export function generateWalletPaddleId(): string {
  const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
  return `P-${hex}`
}

/** Display form shown in UI, e.g. #P-6E8156FD */
export function formatPaddleIdDisplay(paddleId: string): string {
  const trimmed = paddleId.trim().replace(/^#+/, '')
  if (/^P-[A-F0-9]+$/i.test(trimmed)) {
    return `#${trimmed.toUpperCase()}`
  }
  return `#${trimmed}`
}

/** Normalize search input to stored wallet paddle_id (P-XXXXXXXX). */
export function normalizeWalletPaddleIdQuery(raw: string): string | null {
  let q = raw.trim().replace(/^#+/, '')
  if (!q) return null

  const upper = q.toUpperCase()
  if (/^P-[A-F0-9]{8}$/.test(upper)) return upper
  if (/^[A-F0-9]{8}$/.test(upper)) return `P-${upper}`

  // Legacy 4-digit desk wallets
  if (/^\d{4}$/.test(q)) return q

  return null
}

export async function assignWalletPaddleIdIfMissing(
  supabase: SupabaseClient,
  wallet: { id: string; paddle_id: string | null }
): Promise<string | null> {
  if (wallet.paddle_id) return wallet.paddle_id

  const paddleId = generateWalletPaddleId()
  const { error } = await supabase
    .from('wallets')
    .update({ paddle_id: paddleId })
    .eq('id', wallet.id)

  if (error) return null
  return paddleId
}
