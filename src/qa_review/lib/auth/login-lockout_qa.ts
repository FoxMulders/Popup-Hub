const NEDRY_LOCKOUT_STORAGE_KEY = 'popup-hub-nedry-lockout'

export type NedryLockoutState = {
  strikes: number
  expiresAt: number
}

/** Exponential lockout duration (seconds) once strikes reach 3. */
export function lockoutSecondsForStrike(strikeCount: number): number {
  if (strikeCount < 3) return 0
  return 30 * 4 ** (strikeCount - 3)
}

export function formatLockoutCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function readNedryLockoutState(): NedryLockoutState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(NEDRY_LOCKOUT_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<NedryLockoutState>
    if (
      typeof parsed.strikes !== 'number' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.strikes < 3
    ) {
      return null
    }

    return { strikes: parsed.strikes, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

export function writeNedryLockoutState(state: NedryLockoutState): void {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(NEDRY_LOCKOUT_STORAGE_KEY, JSON.stringify(state))
}

export function clearNedryLockoutState(): void {
  if (typeof window === 'undefined') return

  window.sessionStorage.removeItem(NEDRY_LOCKOUT_STORAGE_KEY)
}

export function remainingLockoutSeconds(expiresAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000))
}

export function normalizeLoginCredential(value: string): string {
  return value.trim()
}

export function validateLoginCredentials(email: string, password: string): string | null {
  const trimmedEmail = normalizeLoginCredential(email)
  const trimmedPassword = normalizeLoginCredential(password)

  if (!trimmedEmail) return 'Email is required.'
  if (!trimmedPassword) return 'Password is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return 'Enter a valid email address.'
  }
  return null
}
