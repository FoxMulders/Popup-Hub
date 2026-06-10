'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Lightbulb, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export interface AppMenuLink {
  href: string
  label: string
}

interface AppMenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  links: AppMenuLink[]
  pathname: string
  profileName?: string
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
      <SheetContent side="right" className="flex w-72 max-w-[85vw] flex-col safe-bottom">
        <SheetHeader>
          <SheetTitle className="text-left font-heading">Menu</SheetTitle>
          {profileName ? (
            <p className="truncate text-left text-sm text-muted-foreground">{profileName}</p>
          ) : null}
        </SheetHeader>
        <nav
          className="mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain pb-4 [-webkit-overflow-scrolling:touch]"
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

          <Button
            variant="ghost"
            className="w-full min-h-11 justify-start gap-2"
            size="sm"
            onClick={() => closeAndNavigate('/profile')}
          >
            <User className="h-4 w-4" />
            Profile settings
          </Button>

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
