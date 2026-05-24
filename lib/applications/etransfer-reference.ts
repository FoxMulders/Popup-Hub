const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Six-character memo code for e-transfer identification (no ambiguous 0/O/1/I). */
export function generateEtransferReferenceCode(): string {
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)]
  }
  return code
}

export function etransferHoldExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + 24 * 60 * 60 * 1000).toISOString()
}

export function formatEtransferExpiryCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'

  const hours = Math.floor(ms / (60 * 60 * 1000))
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  if (hours >= 1) return `${hours}h ${minutes}m remaining`
  return `${minutes} minutes remaining`
}
