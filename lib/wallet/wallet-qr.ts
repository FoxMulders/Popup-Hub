import { publicAppUrl } from '@/lib/url/public-app-url'

const UUID_PATTERN = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'

/** HTTPS URL scanned by door staff — works with default phone camera apps. */
export function buildWalletTopUpQrPayload(userId: string): string {
  return publicAppUrl(`/wallet/door?u=${userId}`)
}

/** Accepts QR text, deep link, HTTPS door URL, or raw user UUID. */
export function parseWalletTopUpQrPayload(raw: string): string | null {
  const trimmed = raw.trim()

  const topupMatch = trimmed.match(
    new RegExp(`popuphub:\\/\\/wallet\\/topup\\?user=(${UUID_PATTERN})`, 'i')
  )
  if (topupMatch) return topupMatch[1]

  const legacyMatch = trimmed.match(
    new RegExp(`popuphub:\\/\\/pay\\?shopper=(${UUID_PATTERN})`, 'i')
  )
  if (legacyMatch) return legacyMatch[1]

  const httpsMatch = trimmed.match(
    new RegExp(`[?&](?:u|user)=(${UUID_PATTERN})`, 'i')
  )
  if (httpsMatch) return httpsMatch[1]

  if (new RegExp(`^${UUID_PATTERN}$`, 'i').test(trimmed)) return trimmed
  return null
}
