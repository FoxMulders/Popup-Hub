/** Deep link scanned by door staff to identify a patron wallet. */
export function buildWalletTopUpQrPayload(userId: string): string {
  return `popuphub://wallet/topup?user=${userId}`
}

/** Accepts QR text, deep link, or raw user UUID. */
export function parseWalletTopUpQrPayload(raw: string): string | null {
  const trimmed = raw.trim()
  const topupMatch = trimmed.match(/popuphub:\/\/wallet\/topup\?user=([a-f0-9-]+)/i)
  if (topupMatch) return topupMatch[1]

  const legacyMatch = trimmed.match(/popuphub:\/\/pay\?shopper=([a-f0-9-]+)/i)
  if (legacyMatch) return legacyMatch[1]

  if (/^[a-f0-9-]{36}$/i.test(trimmed)) return trimmed
  return null
}

export function walletTopUpQrImageUrl(userId: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(buildWalletTopUpQrPayload(userId))}`
}
