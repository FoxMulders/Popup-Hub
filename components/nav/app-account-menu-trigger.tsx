'use client'

import { Menu } from 'lucide-react'
import { UserAvatar } from '@/components/profile/user-avatar'
import type { UserAvatarSource } from '@/hooks/use-user-avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface AppAccountMenuTriggerProps {
  menuOpen: boolean
  onToggle: () => void
  userId: string
  profile: UserAvatarSource
  adminPendingCount?: number
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
  adminPendingCount = 0,
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
          'app-tap-target relative flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden',
          mobileClassName,
          className
        )}
        aria-label={
          adminPendingCount > 0
            ? `Open navigation menu — ${adminPendingCount} admin items pending`
            : menuOpen
              ? 'Close navigation menu'
              : 'Open navigation menu'
        }
        aria-expanded={menuOpen}
        onClick={toggle}
      >
        <Menu className="h-5 w-5 text-foreground" />
        {adminPendingCount > 0 ? (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px] leading-none">
            {adminPendingCount > 9 ? '9+' : adminPendingCount}
          </Badge>
        ) : null}
      </button>

      <button
        type="button"
        className={cn(
          'app-tap-target relative hidden min-h-10 min-w-10 items-center justify-center rounded-xl border border-stone-200 bg-white p-0.5 hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex',
          desktopClassName,
          className
        )}
        aria-label={
          adminPendingCount > 0
            ? `Open account menu — ${adminPendingCount} admin items pending`
            : menuOpen
              ? 'Close account menu'
              : 'Open account menu'
        }
        aria-expanded={menuOpen}
        onClick={toggle}
      >
        <UserAvatar
          userId={userId}
          profile={profile}
          className="h-8 w-8"
          fallbackClassName="text-xs"
        />
        {adminPendingCount > 0 ? (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px] leading-none">
            {adminPendingCount > 9 ? '9+' : adminPendingCount}
          </Badge>
        ) : null}
      </button>
    </>
  )
}
