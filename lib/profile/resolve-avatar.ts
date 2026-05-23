import { resolvePublicAssetUrl } from '@/lib/storage/public-url'
import type { Role } from '@/types/database'

export function avatarInitials(fullName: string | null | undefined): string {
  return (
    (fullName ?? ' ')
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  )
}

export function resolveDisplayAvatarUrl(input: {
  role: Role
  avatarUrl: string | null | undefined
  passportLogoUrl?: string | null | undefined
}): string | null {
  const customAvatar = resolvePublicAssetUrl(input.avatarUrl, 'avatars')
  if (customAvatar) return customAvatar

  if (input.role === 'vendor') {
    return resolvePublicAssetUrl(input.passportLogoUrl, 'vendor-assets')
  }

  return null
}
