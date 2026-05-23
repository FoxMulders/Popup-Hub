/**
 * Generates and validates signed check-in tokens.
 * Format: base64url(eventId:applicationId)
 * In production, sign with HMAC-SHA256 using CHECKIN_SECRET.
 */

export function generateCheckinToken(eventId: string, applicationId: string): string {
  const payload = `${eventId}:${applicationId}`
  return Buffer.from(payload).toString('base64url')
}

export function parseCheckinToken(token: string): { eventId: string; applicationId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const colonIndex = decoded.indexOf(':')
    if (colonIndex === -1) return null
    const eventId = decoded.slice(0, colonIndex)
    const applicationId = decoded.slice(colonIndex + 1)
    if (!eventId || !applicationId) return null
    return { eventId, applicationId }
  } catch {
    return null
  }
}
