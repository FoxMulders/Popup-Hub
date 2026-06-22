export const AMAZON_ASSOCIATE_TAG = 'thetipsyfox08-20'

export const AMAZON_ASSOCIATE_DISCLOSURE =
  'As an Amazon Associate, I earn from qualifying purchases.'

/** Amazon.ca search URL with the official associate tag (no static prices). */
export function buildAmazonCaAffiliateSearchUrl(
  searchTerm: string,
  tag: string = AMAZON_ASSOCIATE_TAG
): string {
  const k = encodeURIComponent(searchTerm.trim())
  return `https://www.amazon.ca/s?k=${k}&tag=${tag}`
}

/** Append (or replace) the associate tag on any Amazon.ca URL. */
export function appendAmazonAssociateTag(
  url: string,
  tag: string = AMAZON_ASSOCIATE_TAG
): string {
  const parsed = new URL(url.trim())
  parsed.searchParams.set('tag', tag)
  return parsed.toString()
}
