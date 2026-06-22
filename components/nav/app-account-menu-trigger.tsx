'use client'

import { Menu } from 'lucide-react'
import { UserAvatar } from '@/components/profile/user-avatar'
import type { UserAvatarSource } from '@/hooks/use-user-avatar'
import { cn } from '@/lib/utils'

interface AppAccountMenuTriggerProps {
  menuOpen: boolean
  onToggle: () => void
  userId: string
  profile: UserAvatarSource
  /** Mobile hamburger sizing (default min-h-10). */
  mobileClassName?: string
  /** Desktop avatar trigger sizing (default min-h-10). */
  desktopClassName?: string
  className?: string
}

/** Mobile hamburger + desktop avatar — both open the same account / nav menu sheet. */
export function AppAccountMenuTrigger({
  menuOpen,
  onToggle,
  userId,
  profile,
  mobileClassName,
  desktopClassName,
  className,
}: AppAccountMenuTriggerProps) {
  const toggle = () => onToggle()

  return (
    <>
      <button
        type="button"
        className={cn(
          'app-tap-target flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden',
          mobileClassName,
          className
        )}
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen}
        onClick={toggle}
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      <button
        type="button"
        className={cn(
          'app-tap-target hidden min-h-10 min-w-10 items-center justify-center rounded-xl border border-stone-200 bg-white p-0.5 hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex',
          desktopClassName,
          className
        )}
        aria-label={menuOpen ? 'Close account menu' : 'Open account menu'}
        aria-expanded={menuOpen}
        onClick={toggle}
      >
        <UserAvatar
          userId={userId}
          profile={profile}
          className="h-8 w-8"
          fallbackClassName="text-xs"
        />
      </button>
    </>
  )
}
