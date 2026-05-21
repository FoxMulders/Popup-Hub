import crypto from 'crypto'

/**
 * Validates a Square webhook notification using HMAC-SHA256.
 * Square sends: X-Square-Hmacsha256-Signature header
 * We compute HMAC of (notificationUrl + rawBody) with the webhook signature key.
 */
export function validateSquareWebhook(
  rawBody: string,
  signature: string,
  notificationUrl: string
): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!
  const payload = notificationUrl + rawBody

  const hmac = crypto
    .createHmac('sha256', key)
    .update(payload, 'utf8')
    .digest('base64')

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'base64')
  const hmacBuffer = Buffer.from(hmac, 'base64')

  if (sigBuffer.length !== hmacBuffer.length) return false
  return crypto.timingSafeEqual(sigBuffer, hmacBuffer)
}
