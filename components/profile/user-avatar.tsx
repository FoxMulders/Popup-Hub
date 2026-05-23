'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { VendorLogo, type VendorLogoSize } from '@/components/vendor/vendor-logo'
import { useUserAvatar, type UserAvatarSource } from '@/hooks/use-user-avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  userId: string
  profile: UserAvatarSource
  className?: string
  fallbackClassName?: string
}

function vendorLogoSize(className?: string): VendorLogoSize {
  if (className?.includes('h-20')) return 'profile'
  if (className?.includes('h-12') || className?.includes('h-11')) return 'md'
  return 'xs'
}

export function UserAvatar({
  userId,
  profile,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const { displayUrl, initials, avatarUrl, passportLogoUrl } = useUserAvatar(userId, profile)

  const usingPassportLogo =
    profile.role === 'vendor' && !avatarUrl && Boolean(passportLogoUrl)

  if (usingPassportLogo) {
    return (
      <VendorLogo
        src={passportLogoUrl}
        alt={`${profile.full_name || 'Business'} logo`}
        fallback={initials}
        size={vendorLogoSize(className)}
        className={cn('border-stone-200', className?.includes('h-20') ? undefined : 'max-h-9')}
      />
    )
  }

  return (
    <Avatar className={cn(className)}>
      <AvatarImage src={displayUrl ?? undefined} alt={profile.full_name || 'User avatar'} />
      <AvatarFallback className={cn('bg-sage-100 text-forest font-bold', fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
