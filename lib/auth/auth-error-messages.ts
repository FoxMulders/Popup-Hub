const EXISTING_ACCOUNT_PATTERNS = [
  'user already registered',
  'already been registered',
  'identity is already linked',
  'email address is already registered',
  'account already exists',
]

export function isExistingAccountAuthError(message: string): boolean {
  const lower = message.toLowerCase()
  return EXISTING_ACCOUNT_PATTERNS.some((pattern) => lower.includes(pattern))
}

export function formatExistingAccountAuthMessage(detail?: string | null): string {
  if (detail && isExistingAccountAuthError(detail)) {
    return 'An account with this email already exists. Sign in with email first, then connect Google, Apple, or other providers from Profile → Account Security.'
  }
  if (detail) {
    return detail
  }
  return 'An account with this email may already exist. Sign in with your original method, then connect social login from Profile settings.'
}

export function formatOAuthAuthCallbackError(detail?: string | null): string {
  if (!detail) {
    return 'Sign-in could not be completed. Please try again.'
  }
  if (isExistingAccountAuthError(detail)) {
    return formatExistingAccountAuthMessage(detail)
  }
  return detail
}
