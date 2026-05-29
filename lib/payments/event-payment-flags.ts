/**
 * Unified market payment flags (089) with backward-compatible reads/writes for 087 columns.
 * accepts_credit_card = card checkout enabled (Square and/or Stripe when connected).
 */

export type UnifiedEventPaymentFlags = {
  accepts_credit_card: boolean
  accepts_etransfer: boolean
  accepts_cash: boolean
}

export type LegacyEventPaymentFlags = {
  accepts_square?: boolean | null
  accepts_stripe?: boolean | null
  accepts_offline_etransfer?: boolean | null
  accepts_offline_cash?: boolean | null
}

export type EventPaymentFlagRow = Partial<UnifiedEventPaymentFlags> & LegacyEventPaymentFlags

export function readUnifiedEventPaymentFlags(
  row: EventPaymentFlagRow | Record<string, unknown>
): UnifiedEventPaymentFlags {
  const r = row as EventPaymentFlagRow
  if (
    r.accepts_credit_card !== undefined &&
    r.accepts_credit_card !== null &&
    (r.accepts_etransfer !== undefined || r.accepts_cash !== undefined)
  ) {
    return {
      accepts_credit_card: r.accepts_credit_card !== false,
      accepts_etransfer: r.accepts_etransfer === true,
      accepts_cash: r.accepts_cash === true,
    }
  }

  const credit =
    (r.accepts_square !== false && r.accepts_square !== null) ||
    r.accepts_stripe === true
  return {
    accepts_credit_card: credit,
    accepts_etransfer: r.accepts_offline_etransfer !== false,
    accepts_cash: r.accepts_offline_cash === true,
  }
}

/** Persist unified flags and mirror into legacy 087 columns for PostgREST caches not yet on 089. */
export function writeEventPaymentFlags(
  unified: Partial<UnifiedEventPaymentFlags>
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (typeof unified.accepts_credit_card === 'boolean') {
    out.accepts_credit_card = unified.accepts_credit_card
    out.accepts_square = unified.accepts_credit_card
    out.accepts_stripe = unified.accepts_credit_card
  }
  if (typeof unified.accepts_etransfer === 'boolean') {
    out.accepts_etransfer = unified.accepts_etransfer
    out.accepts_offline_etransfer = unified.accepts_etransfer
  }
  if (typeof unified.accepts_cash === 'boolean') {
    out.accepts_cash = unified.accepts_cash
    out.accepts_offline_cash = unified.accepts_cash
  }
  return out
}

export function readCoordinatorPaymentInstructions(row: {
  payment_instructions?: string | null
  offline_payment_instructions?: string | null
}): string | null {
  const unified = row.payment_instructions?.trim()
  if (unified) return unified
  const legacy = row.offline_payment_instructions?.trim()
  return legacy || null
}

export function writeCoordinatorPaymentInstructions(instructions: string | null): {
  payment_instructions: string | null
  offline_payment_instructions: string | null
} {
  const trimmed = instructions?.trim() || null
  return {
    payment_instructions: trimmed,
    offline_payment_instructions: trimmed,
  }
}
