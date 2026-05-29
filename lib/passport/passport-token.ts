import crypto from 'crypto'
import type { BoothApplication } from '@/types/database'
import { isApplicationPaid } from '@/lib/applications/payment-fields'
import { isReservedBoothStatus } from '@/lib/applications/resolve-approval-status'

const DEFAULT_DEV_SECRET = 'dev-passport-signing-secret'
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export type SignedPassportPayload = {
  eventId: string
  vendorId: string
  applicationId: string
  paymentHash: string
  iat: number
  exp: number
}

function signingSecret(): string {
  return (
    process.env.PASSPORT_SIGNING_SECRET ??
    process.env.PASSPORT_SCAN_SECRET ??
    process.env.CHECKIN_SECRET ??
    DEFAULT_DEV_SECRET
  )
}

export function computePassportPaymentHash(
  app: Pick<
    BoothApplication,
    'id' | 'payment_status' | 'application_payment_status' | 'payment_method' | 'status' | 'approved_at'
  >
): string {
  const material = [
    app.id,
    app.status,
    app.payment_status,
    app.application_payment_status ?? '',
    app.payment_method ?? '',
    app.approved_at ?? '',
  ].join(':')

  return crypto.createHmac('sha256', signingSecret()).update(material).digest('base64url')
}

export function isPassportQrEligible(
  app: Pick<
    BoothApplication,
    'status' | 'payment_status' | 'application_payment_status' | 'payment_method'
  >
): boolean {
  return isReservedBoothStatus(app.status) && isApplicationPaid(app)
}

export function generateSignedPassportToken(
  app: Pick<
    BoothApplication,
    'id' | 'event_id' | 'vendor_id' | 'payment_status' | 'application_payment_status' | 'payment_method' | 'status' | 'approved_at'
  >
): string {
  if (!isPassportQrEligible(app)) {
    throw new Error('Passport QR is only available after payment is completed and application is approved.')
  }

  const now = Date.now()
  const payload: SignedPassportPayload = {
    eventId: app.event_id,
    vendorId: app.vendor_id,
    applicationId: app.id,
    paymentHash: computePassportPaymentHash(app),
    iat: now,
    exp: now + TOKEN_TTL_MS,
  }

  const body = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url')
  const sig = crypto.createHmac('sha256', signingSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySignedPassportToken(
  token: string
): SignedPassportPayload | null {
  const trimmed = token.trim()
  const dotIndex = trimmed.lastIndexOf('.')
  if (dotIndex <= 0) return null

  const body = trimmed.slice(0, dotIndex)
  const sig = trimmed.slice(dotIndex + 1)
  if (!body || !sig) return null

  const expected = crypto.createHmac('sha256', signingSecret()).update(body).digest('base64url')
  try {
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null
  } catch {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf-8')
    ) as SignedPassportPayload

    if (
      !payload.eventId ||
      !payload.vendorId ||
      !payload.applicationId ||
      !payload.paymentHash ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return null
    }

    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export function buildPassportScanQrValue(token: string): string {
  return `popuphub://passport/scan?t=${encodeURIComponent(token)}`
}

/** Legacy v1 token: eventId:vendorId — still accepted during transition. */
export function verifyLegacyPassportScanToken(
  token: string
): { eventId: string; vendorId: string } | null {
  const trimmed = token.trim()
  const dotIndex = trimmed.lastIndexOf('.')
  if (dotIndex <= 0) return null

  const payloadB64 = trimmed.slice(0, dotIndex)
  const sig = trimmed.slice(dotIndex + 1)

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
    .createHmac('sha256', signingSecret())
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
