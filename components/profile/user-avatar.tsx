'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BrandMark, type BrandMarkSize } from '@/components/profile/brand-mark'
import { useUserAvatar, type UserAvatarSource } from '@/hooks/use-user-avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  userId: string
  profile: UserAvatarSource
  className?: string
  fallbackClassName?: string
}

function brandMarkSize(className?: string): BrandMarkSize {
  if (className?.includes('h-20') || className?.includes('h-24') || className?.includes('h-28')) {
    return 'profile'
  }
  if (className?.includes('h-14') || className?.includes('h-12') || className?.includes('h-11')) {
    return 'md'
  }
  return 'nav'
}

export function UserAvatar({
  userId,
  profile,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const { displayUrl, initials, avatarUrl } = useUserAvatar(userId, profile)

  if (profile.role === 'vendor') {
    return (
      <BrandMark
        src={displayUrl ?? avatarUrl}
        alt={`${profile.full_name || 'Business'} logo`}
        fallback={initials}
        size={brandMarkSize(className)}
        className={className}
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
