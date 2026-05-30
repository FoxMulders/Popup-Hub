import type { SupabaseClient } from '@supabase/supabase-js'
import { parseWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'
import { ensureWallet } from '@/lib/wallet/credit-deposit'
import { normalizeWalletPaddleIdQuery } from '@/lib/wallet/paddle-id'
import { getAuctionParticipation } from '@/lib/quarter-auction/participation'
import { centsToCredits } from '@/lib/quarter-auction/credits'

export interface PatronLookupResult {
  id: string
  full_name: string | null
  email: string | null
  walletBalanceCents: number
  walletBalanceCredits: number
  walletNumber: string | null
  participated: boolean
  paddles: { id: string; paddle_number: string }[]
}

const MAX_QUERY_LENGTH = 120
const UUID_RE =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

function normalizeQuery(raw: string): string {
  return raw.trim().slice(0, MAX_QUERY_LENGTH)
}

async function buildPatronResult(
  supabase: SupabaseClient,
  profile: { id: string; full_name: string | null; email: string | null },
  eventId?: string | null
): Promise<PatronLookupResult> {
  const wallet = await ensureWallet(supabase, profile.id)
  const balanceCents = wallet?.balance ?? 0

  let participated = false
  let paddles: { id: string; paddle_number: string }[] = []

  if (eventId) {
    const row = await getAuctionParticipation(supabase, eventId, profile.id)
    participated = !!row

    const { data: paddleRows } = await supabase
      .from('event_paddles')
      .select('id, paddle_number')
      .eq('event_id', eventId)
      .eq('user_id', profile.id)
      .order('paddle_number', { ascending: true })

    paddles = (paddleRows ?? []) as { id: string; paddle_number: string }[]
  }

  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    walletBalanceCents: balanceCents,
    walletBalanceCredits: centsToCredits(balanceCents),
    walletNumber: wallet?.paddle_id ?? null,
    participated,
    paddles,
  }
}

/** Exact patron fetch for desk refresh (by user id). */
export async function lookupPatronById(
  supabase: SupabaseClient,
  userId: string,
  eventId?: string | null
): Promise<PatronLookupResult | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return null
  return buildPatronResult(supabase, profile as { id: string; full_name: string | null; email: string | null }, eventId)
}

export async function lookupPatrons(
  supabase: SupabaseClient,
  rawQuery: string,
  eventId?: string | null
): Promise<PatronLookupResult[]> {
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
        .limit(12)
      for (const row of walletRows ?? []) {
        if (row.user_id) userIds.add(row.user_id as string)
      }
    }
  }

  if (userIds.size < 12) {
    const pattern = `%${query.replace(/[%_,]/g, '')}%`
    const { data: profileMatches } = await supabase
      .from('profiles')
      .select('id')
      .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(12)

    for (const row of profileMatches ?? []) {
      userIds.add(row.id as string)
    }
  }

  if (userIds.size === 0) return []

  const ids = [...userIds].slice(0, 12)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', ids)

  const results: PatronLookupResult[] = []
  for (const profile of profiles ?? []) {
    results.push(
      await buildPatronResult(
        supabase,
        profile as { id: string; full_name: string | null; email: string | null },
        eventId
      )
    )
  }

  return results.sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
}
