'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export interface AppMenuLink {
  href: string
  label: string
}

interface AppMenuSheetProps {
  links: AppMenuLink[]
  pathname: string
  profileName?: string
  unreadCount?: number
  onSignOut?: () => void | Promise<void>
  extraLinks?: AppMenuLink[]
  footer?: React.ReactNode
  className?: string
}

export function AppMenuSheet({
  links,
  pathname,
  profileName,
  unreadCount = 0,
  onSignOut,
  extraLinks = [],
  footer,
  className,
}: AppMenuSheetProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function closeAndNavigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          'app-tap-target flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-canvas',
          className
        )}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Menu className="h-5 w-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 max-w-[85vw] safe-bottom">
          <SheetHeader>
            <SheetTitle className="text-left font-heading">Menu</SheetTitle>
            {profileName ? (
              <p className="text-left text-sm text-muted-foreground truncate">{profileName}</p>
            ) : null}
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-1" aria-label="App menu">
            {links.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                <Button
                  variant={pathname === href || pathname.startsWith(`${href}/`) ? 'secondary' : 'ghost'}
                  className="w-full justify-start min-h-11"
                  size="sm"
                >
                  {label}
                </Button>
              </Link>
            ))}

            {extraLinks.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                <Button variant="ghost" className="w-full justify-start min-h-11" size="sm">
                  {label}
                </Button>
              </Link>
            ))}

            <Button
              variant="ghost"
              className="w-full justify-start min-h-11 gap-2"
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
                className="w-full justify-start min-h-11 text-red-600 hover:text-red-600"
                size="sm"
                onClick={() => {
                  setOpen(false)
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
    </>
  )
}
