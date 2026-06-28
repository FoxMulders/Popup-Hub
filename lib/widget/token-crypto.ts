import { createHash, randomBytes } from 'crypto'

const TOKEN_BYTE_LENGTH = 32

/** Mint an opaque widget token and its SHA-256 hash for storage. */
export function mintWidgetToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTE_LENGTH).toString('base64url')
  return { raw, hash: hashWidgetToken(raw) }
}

export function hashWidgetToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}
