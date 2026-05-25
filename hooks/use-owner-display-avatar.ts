'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveDisplayAvatarUrl } from '@/lib/profile/resolve-avatar'
import { resolveAnyPublicAssetUrl } from '@/lib/storage/public-url'

/**
 * Resolves profile avatar + vendor passport logo for story rings and public headers.
 */
export function useOwnerDisplayAvatar(
  ownerId: string,
  hintUrl?: string | null
): string | null {
  const [url, setUrl] = useState<string | null>(() => resolveAnyPublicAssetUrl(hintUrl))

  useEffect(() => {
    setUrl(resolveAnyPublicAssetUrl(hintUrl))
  }, [hintUrl])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, avatar_url, full_name')
        .eq('id', ownerId)
        .maybeSingle()

      if (cancelled || !profile) return

      let passportLogoUrl: string | null = null
      if (profile.role === 'vendor') {
        const { data: passport } = await supabase
          .from('vendor_passports')
          .select('logo_url')
          .eq('user_id', ownerId)
          .maybeSingle()
        passportLogoUrl = passport?.logo_url ?? null
      }

      const resolved = resolveDisplayAvatarUrl({
        role: profile.role,
        avatarUrl: profile.avatar_url,
        passportLogoUrl,
      })

      if (!cancelled) setUrl(resolved)
    })()

    return () => {
      cancelled = true
    }
  }, [ownerId])

  return url
}
