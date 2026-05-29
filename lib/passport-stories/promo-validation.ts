/**
 * Validation + normalization rules for the Market Promo story kind.
 *
 * Coordinators publish "Market Promo" passport stories that must always
 * carry two pieces of metadata so patrons can find the event from the
 * caption alone:
 *
 *   1. A normalized event hashtag derived from the market name. We
 *      auto-append it when the coordinator forgets, rather than
 *      blocking the publish — keeps the workflow frictionless.
 *   2. An explicit reference to the physical location (venue name,
 *      street address, or city). This is *blocking* — we won't let
 *      the story go live without one of those words in the body so
 *      patrons aren't left guessing where to actually show up.
 *
 * Both rules are pure functions of the caption + market context so
 * they can be unit-tested without spinning up Supabase or React.
 */

export interface MarketPromoContext {
  /** Display name of the market (e.g. "Spring Makers Market"). */
  name: string
  /** Free-form venue label (e.g. "Delwood Community League"). */
  locationName?: string | null
  /** Street address line, when filled. */
  address?: string | null
  /** City label, when separate from the address. */
  city?: string | null
}

/**
 * Strip everything but [A-Za-z0-9] from the market name and prepend
 * a `#`. The first surviving character is upper-cased so the result
 * reads as a tidy CamelCase tag (`Spring Makers Market!` →
 * `#SpringMakersMarket`). Falls back to `#Market` when the name
 * contains no alphanumeric characters at all.
 */
export function normalizeMarketHashtag(name: string): string {
  const compact = (name ?? '').replace(/[^A-Za-z0-9]+/g, '')
  if (!compact) return '#Market'
  const stripped = compact.replace(/^[0-9]+/, '') || compact
  return `#${stripped[0].toUpperCase()}${stripped.slice(1)}`
}

/** Case-insensitive whole-tag match for `#tag` inside the caption. */
export function captionContainsHashtag(caption: string, hashtag: string): boolean {
  const target = hashtag.replace(/^#/, '').toLowerCase()
  if (!target) return true
  // Boundary on either side: start-of-string or non-alphanumeric, then `#tag`,
  // then non-alphanumeric or end. Keeps `#Spring` from matching `#SpringMakers`.
  const re = new RegExp(`(^|[^A-Za-z0-9])#${target}(?![A-Za-z0-9])`, 'i')
  return re.test(caption)
}

/**
 * The body must mention at least one of: venue label, street address
 * (first significant token), or city — case-insensitive substring match.
 * Tokens shorter than 3 characters are ignored to avoid false positives
 * (the city "St" appearing inside "stage", for example).
 */
export function captionMentionsLocation(
  caption: string,
  ctx: MarketPromoContext
): boolean {
  const haystack = caption.toLowerCase()
  const candidates: string[] = []
  for (const raw of [ctx.locationName, ctx.address, ctx.city]) {
    if (!raw) continue
    const trimmed = raw.trim().toLowerCase()
    if (trimmed.length >= 3) candidates.push(trimmed)
    // For multi-word labels, also accept any token >= 4 chars individually
    // so "Delwood Community League" matches a caption that just says
    // "Delwood".
    for (const token of trimmed.split(/[^a-z0-9]+/)) {
      if (token.length >= 4) candidates.push(token)
    }
  }
  if (candidates.length === 0) return true
  return candidates.some((needle) => haystack.includes(needle))
}

export interface MarketPromoValidationResult {
  /** The (possibly auto-appended) caption that should be persisted. */
  caption: string
  /** Hashtag we tried to enforce — exposed so the UI can toast it. */
  hashtag: string
  /** True when the validator added the hashtag for the coordinator. */
  hashtagAppended: boolean
  /**
   * True when the body has no recognizable location reference. The
   * caller is expected to surface a blocking alert in this case.
   */
  missingLocation: boolean
}

/**
 * Run all market-promo enforcement rules in one shot. Pure: returns
 * the corrected caption and a pair of flags the UI uses to decide
 * whether to toast (hashtag) or block (missing location).
 */
export function enforceMarketPromoRules(
  caption: string | null | undefined,
  market: MarketPromoContext
): MarketPromoValidationResult {
  const trimmed = (caption ?? '').trim()
  const hashtag = normalizeMarketHashtag(market.name)
  let next = trimmed
  let hashtagAppended = false
  if (!captionContainsHashtag(trimmed, hashtag)) {
    next = trimmed.length > 0 ? `${trimmed} ${hashtag}` : hashtag
    hashtagAppended = true
  }
  const missingLocation = !captionMentionsLocation(next, market)
  return { caption: next, hashtag, hashtagAppended, missingLocation }
}

/**
 * Human-readable hint surfaced when `missingLocation` is true so the
 * coordinator knows what we want them to add.
 */
export function missingLocationHint(market: MarketPromoContext): string {
  const parts = [market.locationName, market.city].filter(Boolean) as string[]
  if (parts.length === 0) {
    return 'Add the venue or city to the caption so patrons know where to find it.'
  }
  return `Add the venue or city (e.g. "${parts.join(' / ')}") to the caption so patrons know where to find it.`
}
