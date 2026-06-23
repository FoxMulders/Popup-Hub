import type { User } from '@supabase/supabase-js'

/** True when the user has verified their email (OAuth providers are typically pre-confirmed). */
export function isEmailConfirmed(user: Pick<User, 'email_confirmed_at'> | null | undefined): boolean {
  return Boolean(user?.email_confirmed_at)
}

/** Paths an unconfirmed authenticated user may visit. */
export function isUnconfirmedUserAllowedPath(pathname: string): boolean {
  return (
    pathname === '/confirm-email' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/api/auth/callback' ||
    pathname.startsWith('/api/auth/')
  )
}

export function isEmailNotConfirmedAuthError(message: string): boolean {
  return /email not confirmed/i.test(message)
}
