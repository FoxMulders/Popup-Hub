/** Exponential lockout duration (seconds) once strikes reach 3. */
export function lockoutSecondsForStrike(strikeCount: number): number {
  if (strikeCount < 3) return 0
  return 30 * 4 ** (strikeCount - 3)
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
