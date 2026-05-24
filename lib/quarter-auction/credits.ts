/** 1 credit = $0.25 */
export const CREDIT_CENTS = 25

export function creditsToCents(credits: number): number {
  return credits * CREDIT_CENTS
}

export function centsToCredits(cents: number): number {
  return Math.floor(cents / CREDIT_CENTS)
}

export function formatCredits(credits: number): string {
  const dollars = (credits * CREDIT_CENTS) / 100
  return `${credits} credit${credits === 1 ? '' : 's'} ($${dollars.toFixed(2)})`
}

export function formatCreditsShort(credits: number): string {
  return `${credits} cr`
}
