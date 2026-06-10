'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Lightbulb, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { UserAvatar } from '@/components/profile/user-avatar'
import type { UserAvatarSource } from '@/hooks/use-user-avatar'
import { cn } from '@/lib/utils'

export interface AppMenuLink {
  href: string
  label: string
}

interface AppMenuProfile {
  userId: string
  profile: UserAvatarSource
}

interface AppMenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  links: AppMenuLink[]
  pathname: string
  profileName?: string
  menuProfile?: AppMenuProfile
  unreadCount?: number
  onSignOut?: () => void | Promise<void>
  extraLinks?: AppMenuLink[]
  footer?: React.ReactNode
  onSuggestImprovement?: () => void
}

export function AppMenuSheet({
  open,
  onOpenChange,
  links,
  pathname,
  profileName,
  menuProfile,
  unreadCount = 0,
  onSignOut,
  extraLinks = [],
  footer,
  onSuggestImprovement,
}: AppMenuSheetProps) {
  const router = useRouter()

  function closeAndNavigate(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-72 max-w-[85vw] flex-col overflow-x-hidden safe-bottom"
      >
        {menuProfile ? (
          <div className="shrink-0 overflow-x-hidden border-b border-stone-200 pb-4">
            <Link
              href="/profile"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Profile settings"
            >
              <UserAvatar
                userId={menuProfile.userId}
                profile={menuProfile.profile}
                className="h-12 w-12 shrink-0"
                fallbackClassName="text-sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-base font-semibold">
                  {profileName || 'Your profile'}
                </p>
                <p className="truncate text-sm text-muted-foreground">Profile settings</p>
              </div>
            </Link>
          </div>
        ) : (
          <SheetHeader className="overflow-x-hidden">
            <SheetTitle className="text-left font-heading">Menu</SheetTitle>
            {profileName ? (
              <p className="truncate text-left text-sm text-muted-foreground">{profileName}</p>
            ) : null}
          </SheetHeader>
        )}
        <nav
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-4 [-webkit-overflow-scrolling:touch]',
            menuProfile ? 'mt-4' : 'mt-6'
          )}
          aria-label="App menu"
        >
          {links.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => onOpenChange(false)}>
              <Button
                variant={pathname === href || pathname.startsWith(`${href}/`) ? 'secondary' : 'ghost'}
                className="w-full min-h-11 justify-start"
                size="sm"
              >
                {label}
              </Button>
            </Link>
          ))}

          {extraLinks.map(({ href, label }) => (
            <Link key={`${href}-${label}`} href={href} onClick={() => onOpenChange(false)}>
              <Button variant="ghost" className="w-full min-h-11 justify-start" size="sm">
                {label}
              </Button>
            </Link>
          ))}

          {!menuProfile ? (
            <Button
              variant="ghost"
              className="w-full min-h-11 justify-start gap-2"
              size="sm"
              onClick={() => closeAndNavigate('/profile')}
            >
              Profile settings
            </Button>
          ) : null}

          {onSuggestImprovement ? (
            <Button
              variant="ghost"
              className="w-full min-h-11 justify-start gap-2"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onSuggestImprovement()
              }}
            >
              <Lightbulb className="h-4 w-4" />
              Suggest an Improvement
            </Button>
          ) : null}

          <Button
            variant="ghost"
            className="w-full min-h-11 justify-start gap-2"
            size="sm"
            onClick={() => closeAndNavigate('/notifications')}
          >
            <Bell className="h-4 w-4" />
            Notifications
            {unreadCount > 0 ? (
              <Badge className="ml-auto bg-red-500 text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            ) : null}
          </Button>

          {onSignOut ? (
            <Button
              variant="ghost"
              className="w-full min-h-11 justify-start text-red-600 hover:text-red-600"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                void onSignOut()
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          ) : null}

          {footer ? <div className="mt-4 space-y-2 border-t pt-4">{footer}</div> : null}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
