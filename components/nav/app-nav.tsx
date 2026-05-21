'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Bell, LogOut, Menu, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Profile } from '@/types/database'
import { useNotificationCount } from '@/hooks/use-notification-count'

interface AppNavProps {
  profile: Profile
}

const NAV_LINKS: Record<string, { href: string; label: string }[]> = {
  shopper: [
    { href: '/shopper/dashboard', label: 'Discover Markets' },
    { href: '/wallet', label: 'Wallet' },
  ],
  vendor: [
    { href: '/vendor/dashboard', label: 'Dashboard' },
    { href: '/vendor/passport', label: 'My Passport' },
    { href: '/vendor/events', label: 'Browse Events' },
    { href: '/vendor/applications', label: 'Applications' },
    { href: '/wallet', label: 'Wallet' },
  ],
  coordinator: [
    { href: '/coordinator/dashboard', label: 'Dashboard' },
    { href: '/coordinator/events/new', label: 'New Event' },
    { href: '/wallet', label: 'Wallet' },
  ],
}

export function AppNav({ profile }: AppNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const unreadCount = useNotificationCount(profile.id)
  const links = NAV_LINKS[profile.role] ?? []

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials =
    (profile.full_name || ' ')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3 xl:px-10">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 shadow-sm">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">Popup Hub</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-0.5">
            {links.map(({ href, label }) => (
              <Link key={href} href={href}>
                <Button
                  variant={pathname === href || pathname.startsWith(href + '/') ? 'secondary' : 'ghost'}
                  size="sm"
                  className="text-sm font-medium h-8"
                >
                  {label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <Link href="/notifications">
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </Link>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="h-9 w-9 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-amber-100 text-amber-700 text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-semibold truncate">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{profile.role}</p>
              </div>
              <div className="py-1">
                <DropdownMenuItem
                  onClick={() => router.push('/profile')}
                  className="cursor-pointer gap-2"
                >
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push('/wallet')}
                  className="cursor-pointer gap-2"
                >
                  Wallet
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-red-600 focus:text-red-600 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile hamburger */}
          <Sheet>
            <SheetTrigger
              render={
                <button className="lg:hidden h-9 w-9 flex items-center justify-center rounded-lg hover:bg-gray-100">
                  <Menu className="h-5 w-5" />
                </button>
              }
            />
            <SheetContent side="left" className="w-64">
              <div className="flex flex-col gap-1 mt-6">
                {links.map(({ href, label }) => (
                  <Link key={href} href={href}>
                    <Button
                      variant={pathname.startsWith(href) ? 'secondary' : 'ghost'}
                      className="w-full justify-start"
                      size="sm"
                    >
                      {label}
                    </Button>
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
