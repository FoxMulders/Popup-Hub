'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subscribeAvatarRealtime } from '@/lib/profile/avatar-realtime'
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

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    void refreshRef.current()
  }, [userId, role])

  useEffect(() => {
    const unsubscribeRealtime = subscribeAvatarRealtime(userId, role, {
      onProfile: ({ avatar_url, full_name }) => {
        setAvatarUrl(avatar_url)
        if (full_name) setFullName(full_name)
      },
      onPassport: role === 'vendor' ? setPassportLogoUrl : undefined,
    })

    function onAvatarChanged(event: Event) {
      const detail = (event as CustomEvent<{ userId: string }>).detail
      if (detail?.userId === userId) void refreshRef.current()
    }

    window.addEventListener(AVATAR_CHANGED, onAvatarChanged)

    let broadcast: BroadcastChannel | null = null
    try {
      broadcast = new BroadcastChannel(AVATAR_BROADCAST)
      broadcast.onmessage = (event) => {
        if (event.data?.userId === userId) void refreshRef.current()
      }
    } catch {
      // ignore
    }

    return () => {
      unsubscribeRealtime()
      window.removeEventListener(AVATAR_CHANGED, onAvatarChanged)
      broadcast?.close()
    }
  }, [userId, role])

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
