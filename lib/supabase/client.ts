import { createBrowserClient } from '@supabase/ssr'

function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:'
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return []
          return document.cookie.split('; ').flatMap((chunk) => {
            const eq = chunk.indexOf('=')
            if (eq < 0) return []
            const name = chunk.slice(0, eq).trim()
            const value = chunk.slice(eq + 1).trim()
            return name ? [{ name, value: decodeURIComponent(value) }] : []
          })
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return
          cookiesToSet.forEach(({ name, value, options }) => {
            const parts = [
              `${name}=${encodeURIComponent(value)}`,
              `path=${options?.path ?? '/'}`,
            ]
            if (options?.maxAge) parts.push(`max-age=${options.maxAge}`)
            if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`)
            else parts.push('SameSite=Lax')
            if (options?.secure || isSecureContext()) parts.push('Secure')
            document.cookie = parts.join('; ')
          })
        },
      },
      cookieOptions: {
        path: '/',
        sameSite: 'lax',
        secure: isSecureContext(),
      },
      auth: {
        // OAuth codes are exchanged server-side in /api/auth/callback.
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    }
  )
}
