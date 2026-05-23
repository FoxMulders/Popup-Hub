'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUserAvatar, type UserAvatarSource } from '@/hooks/use-user-avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  userId: string
  profile: UserAvatarSource
  className?: string
  fallbackClassName?: string
}

export function UserAvatar({
  userId,
  profile,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const { displayUrl, initials } = useUserAvatar(userId, profile)

  return (
    <Avatar className={cn(className)}>
      <AvatarImage src={displayUrl ?? undefined} alt={profile.full_name || 'User avatar'} />
      <AvatarFallback className={cn('bg-sage-100 text-forest font-bold', fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
