'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/profile/user-avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { MobileNavSheet } from '@/components/nav/mobile-nav-sheet'
import { Bell, LogOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Profile } from '@/types/database'
import { PortalSwitcherMenuItems } from '@/components/nav/portal-switcher'
import { useNotificationCount } from '@/hooks/use-notification-count'

interface AppNavProps {
  profile: Profile
  vendorPortal?: boolean
  approvalCount?: number
}

const NAV_LINKS: Record<string, { href: string; label: string }[]> = {
  shopper: [
    { href: '/discover', label: 'Discover Markets' },
    { href: '/favorites', label: 'Favorites' },
    { href: '/wallet', label: 'Wallet' },
  ],
  vendor: [
    { href: '/vendor/dashboard', label: 'Dashboard' },
    { href: '/vendor/passport', label: 'My Passport' },
    { href: '/vendor/events', label: 'Apply for open markets' },
    { href: '/vendor/applications', label: 'Applications' },
    { href: '/wallet', label: 'Wallet' },
  ],
  coordinator: [
    { href: '/coordinator/dashboard', label: 'Dashboard' },
    { href: '/coordinator/events/new', label: 'New Event' },
    { href: '/wallet', label: 'Wallet' },
  ],
}

export function AppNav({ profile, vendorPortal = false, approvalCount = 0 }: AppNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const unreadCount = useNotificationCount(profile.id)
  const navRole = vendorPortal ? 'vendor' : profile.role
  const links = NAV_LINKS[navRole] ?? []
  const homeHref = vendorPortal ? '/vendor/dashboard' : profile.role === 'coordinator' ? '/coordinator/dashboard' : '/discover'

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const avatarProfile = {
    role: profile.role,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  }

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)]">
      <div className="mx-auto flex max-w-full items-center justify-between overflow-x-hidden px-4 py-3 xl:max-w-[1600px] xl:px-10">
        <div className="flex min-w-0 items-center gap-8">
          <Link href={homeHref} className="shrink-0">
            <BrandLogoLockup />
          </Link>

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

        <div className="flex items-center gap-2">
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

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="h-9 w-9 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <UserAvatar
                    userId={profile.id}
                    profile={avatarProfile}
                    className="h-9 w-9"
                    fallbackClassName="text-xs"
                  />
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
                {vendorPortal && (
                  <PortalSwitcherMenuItems
                    hasVendorAccess={approvalCount > 0}
                    currentPortal="vendor"
                  />
                )}
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

          <MobileNavSheet links={links} pathname={pathname} side="left" className="lg:hidden" />
        </div>
      </div>
    </nav>
  )
}
