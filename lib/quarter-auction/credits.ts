/** 1 quarter = $0.25 */
export const CREDIT_CENTS = 25

/** Virtual paddle purchase price: 8 quarters = $2.00 */
export const DEFAULT_PADDLE_PURCHASE_CREDITS = 8

/** Default bid entry for new catalog items (each item may use 1, 2, or more quarters). */
export const DEFAULT_ENTRY_CREDITS = 1

export const QUARTERS_IN_HEADLINE = 'Quarters In, Paddles Up!'

export function creditsToCents(credits: number): number {
  return credits * CREDIT_CENTS
}

export function centsToCredits(cents: number): number {
  return Math.floor(cents / CREDIT_CENTS)
}

export function formatCredits(credits: number): string {
  const dollars = (credits * CREDIT_CENTS) / 100
  return `${credits} quarter${credits === 1 ? '' : 's'} ($${dollars.toFixed(2)})`
}

export function formatCreditsShort(credits: number): string {
  return `${credits} qtr${credits === 1 ? '' : 's'}`
}
