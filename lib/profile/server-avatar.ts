import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveDisplayAvatarUrl } from '@/lib/profile/resolve-avatar'
import type { Role } from '@/types/database'

/** Resolve avatar URL for server-rendered public profile views. */
export async function resolveProfileAvatarForServer(
  supabase: SupabaseClient,
  profile: { id: string; role: Role; avatar_url: string | null }
): Promise<string | null> {
  if (profile.avatar_url) {
    return resolveDisplayAvatarUrl({
      role: profile.role,
      avatarUrl: profile.avatar_url,
    })
  }

  if (profile.role !== 'vendor') return null

  const { data: passport } = await supabase
    .from('vendor_passports')
    .select('logo_url')
    .eq('user_id', profile.id)
    .maybeSingle()

  return resolveDisplayAvatarUrl({
    role: profile.role,
    avatarUrl: null,
    passportLogoUrl: passport?.logo_url ?? null,
  })
}
