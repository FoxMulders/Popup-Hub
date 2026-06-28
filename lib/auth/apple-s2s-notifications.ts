import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { SupabaseClient } from '@supabase/supabase-js'

const APPLE_ISSUER = 'https://appleid.apple.com'
const APPLE_JWKS_URL = new URL(`${APPLE_ISSUER}/auth/keys`)
const DEFAULT_BUNDLE_ID = 'ca.popuphub.app'

export type AppleS2SEventType =
  | 'account-delete'
  | 'consent-revoked'
  | 'email-enabled'
  | 'email-disabled'

export type AppleS2SEvent = {
  type: AppleS2SEventType
  sub: string
  email?: string
}

let appleJwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getAppleJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!appleJwks) {
    appleJwks = createRemoteJWKSet(APPLE_JWKS_URL)
  }
  return appleJwks
}

function resolveAppleAudiences(): string[] {
  const bundleId = process.env.APPLE_BUNDLE_ID?.trim() || DEFAULT_BUNDLE_ID
  const servicesId = process.env.APPLE_SERVICES_ID?.trim()
  return servicesId ? [bundleId, servicesId] : [bundleId]
}

/** Parse the `events` claim from a verified Apple S2S JWT payload. */
export function parseAppleNotificationEvents(claims: JWTPayload): AppleS2SEvent | null {
  const rawEvents = claims.events
  if (!rawEvents || typeof rawEvents !== 'object' || Array.isArray(rawEvents)) {
    return null
  }

  const events = rawEvents as Record<string, unknown>
  const type = events.type
  const sub = events.sub

  if (typeof type !== 'string' || typeof sub !== 'string') {
    return null
  }

  if (
    type !== 'account-delete' &&
    type !== 'consent-revoked' &&
    type !== 'email-enabled' &&
    type !== 'email-disabled'
  ) {
    return null
  }

  const email = typeof events.email === 'string' ? events.email : undefined

  return { type, sub, email }
}

/** Verify Apple's signed server-to-server notification JWT. */
export async function verifyAppleNotificationPayload(payload: string): Promise<AppleS2SEvent> {
  const { payload: claims } = await jwtVerify(payload, getAppleJwks(), {
    issuer: APPLE_ISSUER,
    audience: resolveAppleAudiences(),
  })

  const event = parseAppleNotificationEvents(claims)
  if (!event) {
    throw new Error('Invalid Apple notification events claim')
  }

  return event
}

export async function findUserIdByAppleSub(
  admin: SupabaseClient,
  appleSub: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema('auth')
    .from('identities')
    .select('user_id')
    .eq('provider', 'apple')
    .filter('identity_data->>sub', 'eq', appleSub)
    .maybeSingle()

  if (error) {
    throw new Error(`Apple identity lookup failed: ${error.message}`)
  }

  return data?.user_id ?? null
}

async function countUserIdentities(admin: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await admin
    .schema('auth')
    .from('identities')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Identity count failed: ${error.message}`)
  }

  return count ?? 0
}

async function deleteAppleIdentity(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin
    .schema('auth')
    .from('identities')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'apple')

  if (error) {
    throw new Error(`Apple identity delete failed: ${error.message}`)
  }
}

async function revokeUserSessions(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.schema('auth').from('sessions').delete().eq('user_id', userId)

  if (error) {
    throw new Error(`Session revoke failed: ${error.message}`)
  }
}

export type AppleS2SHandleResult =
  | { ok: true; action: 'deleted' | 'revoked' | 'logged' | 'noop' }
  | { ok: false; error: string }

/** Apply Apple account lifecycle event to Supabase Auth. */
export async function handleAppleS2SNotification(
  admin: SupabaseClient,
  event: AppleS2SEvent,
): Promise<AppleS2SHandleResult> {
  const userId = await findUserIdByAppleSub(admin, event.sub)

  if (!userId) {
    console.info('[apple-s2s] no user for Apple sub', { type: event.type, sub: event.sub })
    return { ok: true, action: 'noop' }
  }

  switch (event.type) {
    case 'account-delete': {
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) {
        return { ok: false, error: error.message }
      }
      console.info('[apple-s2s] deleted user', { userId, sub: event.sub })
      return { ok: true, action: 'deleted' }
    }

    case 'consent-revoked': {
      const identityCount = await countUserIdentities(admin, userId)

      if (identityCount <= 1) {
        const { error } = await admin.auth.admin.deleteUser(userId)
        if (error) {
          return { ok: false, error: error.message }
        }
        console.info('[apple-s2s] deleted Apple-only user after consent revoke', {
          userId,
          sub: event.sub,
        })
        return { ok: true, action: 'deleted' }
      }

      await deleteAppleIdentity(admin, userId)
      await revokeUserSessions(admin, userId)
      console.info('[apple-s2s] unlinked Apple identity and revoked sessions', {
        userId,
        sub: event.sub,
      })
      return { ok: true, action: 'revoked' }
    }

    case 'email-enabled':
    case 'email-disabled':
      console.info('[apple-s2s] relay email preference changed', {
        type: event.type,
        userId,
        sub: event.sub,
        email: event.email ?? null,
      })
      return { ok: true, action: 'logged' }

    default:
      return { ok: true, action: 'noop' }
  }
}
