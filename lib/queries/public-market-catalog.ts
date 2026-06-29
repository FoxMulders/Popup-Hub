/**
 * Patron/vendor discover surfaces must exclude QA scenario markets (`events.is_test`).
 * Sitemap uses the same rule in `lib/seo/collect-sitemap-entries.ts`.
 */
export const PUBLIC_MARKET_CATALOG_EXCLUDE_TEST = false as const
