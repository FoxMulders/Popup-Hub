import crypto from 'crypto'

const DEFAULT_DEV_SECRET = 'dev-passport-scan-secret'

function scanSecret(): string {
  return (
    process.env.PASSPORT_SCAN_SECRET ??
    process.env.CHECKIN_SECRET ??
    DEFAULT_DEV_SECRET
  )
}

/** Signed token encoding event + vendor for patron passport QR scans. */
export function generatePassportScanToken(eventId: string, vendorId: string): string {
  const payload = `${eventId}:${vendorId}`
  const sig = crypto.createHmac('sha256', scanSecret()).update(payload).digest('base64url')
  return `${Buffer.from(payload, 'utf-8').toString('base64url')}.${sig}`
}

export function verifyPassportScanToken(
  token: string
): { eventId: string; vendorId: string } | null {
  const trimmed = token.trim()
  const dotIndex = trimmed.lastIndexOf('.')
  if (dotIndex <= 0) return null

  const payloadB64 = trimmed.slice(0, dotIndex)
  const sig = trimmed.slice(dotIndex + 1)
  if (!payloadB64 || !sig) return null

  let payload: string
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString('utf-8')
  } catch {
    return null
  }

  const colonIndex = payload.indexOf(':')
  if (colonIndex <= 0) return null

  const eventId = payload.slice(0, colonIndex)
  const vendorId = payload.slice(colonIndex + 1)
  if (!eventId || !vendorId) return null

  const expected = crypto
    .createHmac('sha256', scanSecret())
    .update(payload)
    .digest('base64url')

  try {
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null
  } catch {
    return null
  }

  return { eventId, vendorId }
}

/** Accepts raw signed token or deep link / HTTPS URL containing ?t= token. */
export function parsePassportScanPayload(raw: string): string | null {
  const trimmed = raw.trim()

  const deepLink = trimmed.match(/popuphub:\/\/passport\/scan\?t=([^&]+)/i)
  if (deepLink) return decodeURIComponent(deepLink[1])

  try {
    const url = new URL(trimmed)
    const fromQuery = url.searchParams.get('t')
    if (fromQuery) return fromQuery
  } catch {
    /* not a URL */
  }

  if (trimmed.includes('.')) return trimmed
  return null
}

export function buildPassportScanQrValue(eventId: string, vendorId: string): string {
  const token = generatePassportScanToken(eventId, vendorId)
  return `popuphub://passport/scan?t=${encodeURIComponent(token)}`
}
