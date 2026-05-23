'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AVATAR_BROADCAST, AVATAR_CHANGED } from '@/lib/profile/avatar-sync'
import { avatarInitials, resolveDisplayAvatarUrl } from '@/lib/profile/resolve-avatar'
import type { Role } from '@/types/database'

export interface UserAvatarSource {
  role: Role
  full_name: string
  avatar_url: string | null
}

export function useUserAvatar(userId: string, initial: UserAvatarSource) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatar_url)
  const [passportLogoUrl, setPassportLogoUrl] = useState<string | null>(null)
  const [fullName, setFullName] = useState(initial.full_name)
  const role = initial.role

  useEffect(() => {
    setAvatarUrl(initial.avatar_url)
    setFullName(initial.full_name)
  }, [initial.avatar_url, initial.full_name])

  const refresh = useCallback(async () => {
    const supabase = createClient()

    const [{ data: profile }, { data: passport }] = await Promise.all([
      supabase.from('profiles').select('avatar_url, full_name').eq('id', userId).maybeSingle(),
      role === 'vendor'
        ? supabase.from('vendor_passports').select('logo_url').eq('user_id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (profile) {
      setAvatarUrl(profile.avatar_url)
      setFullName(profile.full_name)
    }

    if (role === 'vendor') {
      setPassportLogoUrl(passport?.logo_url ?? null)
    }
  }, [userId, role])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const supabase = createClient()

    const profileChannel = supabase
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
          if ('avatar_url' in next) setAvatarUrl(next.avatar_url ?? null)
          if (next.full_name) setFullName(next.full_name)
        }
      )
      .subscribe()

    let passportChannel: ReturnType<typeof supabase.channel> | null = null
    if (role === 'vendor') {
      passportChannel = supabase
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
            if ('logo_url' in next) setPassportLogoUrl(next.logo_url ?? null)
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
            setPassportLogoUrl(next.logo_url ?? null)
          }
        )
        .subscribe()
    }

    function onAvatarChanged(event: Event) {
      const detail = (event as CustomEvent<{ userId: string }>).detail
      if (detail?.userId === userId) void refresh()
    }

    window.addEventListener(AVATAR_CHANGED, onAvatarChanged)

    let broadcast: BroadcastChannel | null = null
    try {
      broadcast = new BroadcastChannel(AVATAR_BROADCAST)
      broadcast.onmessage = (event) => {
        if (event.data?.userId === userId) void refresh()
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener(AVATAR_CHANGED, onAvatarChanged)
      broadcast?.close()
      supabase.removeChannel(profileChannel)
      if (passportChannel) supabase.removeChannel(passportChannel)
    }
  }, [userId, role, refresh])

  const displayUrl = useMemo(
    () =>
      resolveDisplayAvatarUrl({
        role,
        avatarUrl,
        passportLogoUrl,
      }),
    [role, avatarUrl, passportLogoUrl]
  )

  const initials = useMemo(() => avatarInitials(fullName), [fullName])

  return {
    displayUrl,
    initials,
    avatarUrl,
    passportLogoUrl,
    refresh,
  }
}
