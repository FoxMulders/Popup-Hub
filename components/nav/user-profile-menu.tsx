'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Lightbulb, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/profile/user-avatar'
import type { UserAvatarSource } from '@/hooks/use-user-avatar'
import type { AppMenuLink } from '@/components/nav/app-menu-sheet'
import { cn } from '@/lib/utils'

interface UserProfileMenuProfile {
  userId: string
  profile: UserAvatarSource
}

interface UserProfileMenuProps {
  links: AppMenuLink[]
  pathname: string
  profileName?: string
  menuProfile?: UserProfileMenuProfile
  unreadCount?: number
  onSignOut?: () => void | Promise<void>
  extraLinks?: AppMenuLink[]
  footer?: React.ReactNode
  onSuggestImprovement?: () => void
  /** Guest trigger when no signed-in profile is available. */
  guest?: boolean
}

export function UserProfileMenu({
  links,
  pathname,
  profileName,
  menuProfile,
  unreadCount = 0,
  onSignOut,
  extraLinks = [],
  footer,
  onSuggestImprovement,
  guest = false,
}: UserProfileMenuProps) {
  const router = useRouter()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  function navigate(href: string) {
    router.push(href)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'app-tap-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          menuProfile ? 'p-0.5' : 'p-2'
        )}
        aria-label={guest ? 'Open menu' : 'Open profile menu'}
      >
        {menuProfile ? (
          <UserAvatar
            userId={menuProfile.userId}
            profile={menuProfile.profile}
            className="h-9 w-9"
            fallbackClassName="text-xs"
          />
        ) : (
          <User className="h-5 w-5 text-foreground" aria-hidden />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 max-w-[85vw] overflow-x-hidden"
      >
        {menuProfile ? (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-3">
                <UserAvatar
                  userId={menuProfile.userId}
                  profile={menuProfile.profile}
                  className="h-10 w-10 shrink-0"
                  fallbackClassName="text-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold">
                    {profileName || 'Your profile'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">Profile settings</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/profile')}>
              Profile settings
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuLabel className="font-heading text-sm">
            {profileName || 'Menu'}
          </DropdownMenuLabel>
        )}

        {links.map(({ href, label }) => (
          <DropdownMenuItem
            key={href}
            onSelect={() => navigate(href)}
            className={cn(isActive(href) && 'bg-muted font-medium')}
          >
            {label}
          </DropdownMenuItem>
        ))}

        {extraLinks.map(({ href, label }) => (
          <DropdownMenuItem key={`${href}-${label}`} onSelect={() => navigate(href)}>
            {label}
          </DropdownMenuItem>
        ))}

        {!menuProfile ? (
          <DropdownMenuItem onSelect={() => navigate('/profile')}>Profile settings</DropdownMenuItem>
        ) : null}

        {onSuggestImprovement ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                onSuggestImprovement()
              }}
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              Suggest an Improvement
            </DropdownMenuItem>
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/notifications')}>
          <Bell className="mr-2 h-4 w-4" />
          Notifications
          {unreadCount > 0 ? (
            <Badge className="ml-auto bg-red-500 text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          ) : null}
        </DropdownMenuItem>

        {onSignOut ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              void onSignOut()
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        ) : null}

        {footer ? (
          <>
            <DropdownMenuSeparator />
            <div className="space-y-2 p-2">{footer}</div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
