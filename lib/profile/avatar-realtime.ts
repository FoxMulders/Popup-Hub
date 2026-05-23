import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

type ProfileAvatarHandler = (data: {
  avatar_url: string | null
  full_name: string
}) => void

type PassportLogoHandler = (logo_url: string | null) => void

interface UserAvatarRealtime {
  profileHandlers: Set<ProfileAvatarHandler>
  passportHandlers: Set<PassportLogoHandler>
  profileChannel: RealtimeChannel | null
  passportChannel: RealtimeChannel | null
}

const subscriptions = new Map<string, UserAvatarRealtime>()

function getSubscription(userId: string): UserAvatarRealtime {
  let sub = subscriptions.get(userId)
  if (!sub) {
    sub = {
      profileHandlers: new Set(),
      passportHandlers: new Set(),
      profileChannel: null,
      passportChannel: null,
    }
    subscriptions.set(userId, sub)
  }
  return sub
}

function ensureProfileChannel(userId: string, sub: UserAvatarRealtime) {
  if (sub.profileChannel) return

  const supabase = createClient()
  sub.profileChannel = supabase
    .channel(`profile-avatar:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        const next = payload.new as { avatar_url?: string | null; full_name?: string }
        const update = {
          avatar_url: next.avatar_url ?? null,
          full_name: next.full_name ?? '',
        }
        for (const handler of sub.profileHandlers) {
          handler(update)
        }
      }
    )
    .subscribe()
}

function ensurePassportChannel(userId: string, sub: UserAvatarRealtime) {
  if (sub.passportChannel) return

  const supabase = createClient()
  sub.passportChannel = supabase
    .channel(`passport-logo:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'vendor_passports',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const next = payload.new as { logo_url?: string | null }
        for (const handler of sub.passportHandlers) {
          handler(next.logo_url ?? null)
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'vendor_passports',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const next = payload.new as { logo_url?: string | null }
        for (const handler of sub.passportHandlers) {
          handler(next.logo_url ?? null)
        }
      }
    )
    .subscribe()
}

function teardownIfIdle(userId: string, sub: UserAvatarRealtime) {
  if (sub.profileHandlers.size > 0 || sub.passportHandlers.size > 0) return

  const supabase = createClient()
  if (sub.profileChannel) {
    supabase.removeChannel(sub.profileChannel)
    sub.profileChannel = null
  }
  if (sub.passportChannel) {
    supabase.removeChannel(sub.passportChannel)
    sub.passportChannel = null
  }
  subscriptions.delete(userId)
}

export function subscribeAvatarRealtime(
  userId: string,
  role: string,
  handlers: {
    onProfile: ProfileAvatarHandler
    onPassport?: PassportLogoHandler
  }
): () => void {
  const sub = getSubscription(userId)
  sub.profileHandlers.add(handlers.onProfile)
  ensureProfileChannel(userId, sub)

  if (role === 'vendor' && handlers.onPassport) {
    sub.passportHandlers.add(handlers.onPassport)
    ensurePassportChannel(userId, sub)
  }

  return () => {
    sub.profileHandlers.delete(handlers.onProfile)
    if (handlers.onPassport) {
      sub.passportHandlers.delete(handlers.onPassport)
    }
    teardownIfIdle(userId, sub)
  }
}
