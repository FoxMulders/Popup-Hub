import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const ADMIN_SESSION_COOKIE = 'admin_session'

export function readAdminSessionToken(
  request?: Request,
  cookieValue?: string | null
): string | null {
  if (request) {
    const authorization = request.headers.get('authorization')
    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length).trim() || null
    }
  }
  return cookieValue ?? null
}

export function isAdminSessionTokenValid(token: string | null | undefined): boolean {
  const secret = process.env.ADMIN_SESSION_TOKEN
  if (!secret || !token) return false
  return token === secret
}

/** True when the signed-in profile has is_admin or a valid administrative session token. */
export async function hasAdminAccess(request?: Request): Promise<boolean> {
  const cookieStore = await cookies()
  const sessionToken = readAdminSessionToken(
    request,
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  )

  if (isAdminSessionTokenValid(sessionToken)) return true

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return profile?.is_admin === true
}

export type AdminDbContext =
  | { ok: true; db: ReturnType<typeof createAdminClient> }
  | { ok: false }

/** Resolves a service-role client when admin access is granted. */
export async function resolveAdminDb(request?: Request): Promise<AdminDbContext> {
  const allowed = await hasAdminAccess(request)
  if (!allowed) return { ok: false }
  return { ok: true, db: createAdminClient() }
}
