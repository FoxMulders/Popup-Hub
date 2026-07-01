/**
 * QA scenario markets (`events.is_test = true`) must stay off patron/vendor/widget
 * discovery surfaces. Sitemap generation already excludes them; catalog queries must too.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function excludeTestMarkets<T extends { eq: (column: string, value: unknown) => T }>(
  query: T
): T {
  return query.eq('is_test', false)
}
