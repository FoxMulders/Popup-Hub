'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolvePublicAssetUrl } from '@/lib/storage/public-url'

/**
 * Official brand logo for passport story fallbacks (vendor passport logo, else profile avatar).
 */
export function useOwnerBrandLogo(ownerId: string): string | null {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, avatar_url')
        .eq('id', ownerId)
        .maybeSingle()

      if (cancelled || !profile) return

      let rawLogo: string | null = profile.avatar_url

      if (profile.role === 'vendor') {
        const { data: passport } = await supabase
          .from('vendor_passports')
          .select('logo_url')
          .eq('user_id', ownerId)
          .maybeSingle()
        rawLogo = passport?.logo_url ?? profile.avatar_url
      }

      const bucket = profile.role === 'vendor' ? 'vendor-assets' : 'avatars'
      if (!cancelled) {
        setLogoUrl(resolvePublicAssetUrl(rawLogo, bucket))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [ownerId])

  return logoUrl
}
