import type { SupabaseClient } from '@supabase/supabase-js'

export const INTENTIONAL_SIGNOUT_KEY = 'popup-hub:intentional-signout'

/** Clears the session and hard-navigates to login without return-path query params. */
export async function signOutAndRedirectToLogin(supabase: SupabaseClient): Promise<void> {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(INTENTIONAL_SIGNOUT_KEY, '1')
  }

  const { error } = await supabase.auth.signOut()
  if (error) {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(INTENTIONAL_SIGNOUT_KEY)
    }
    throw error
  }

  if (typeof window !== 'undefined') {
    window.location.replace('/login')
  }
}
