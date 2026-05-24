'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { MobileNavSheet } from '@/components/nav/mobile-nav-sheet'
import { PortalTabs } from '@/components/nav/portal-tabs'
import { resolveActivePortal } from '@/lib/portals/active-portal'
import type { ActivePortal } from '@/lib/portals/active-portal'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/profile/user-avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Profile } from '@/types/database'

interface ShopperTopBarProps {
  profile: Profile | null
  availablePortals?: ActivePortal[]
  portalCookie?: string
}

export function ShopperTopBar({
  profile,
  availablePortals = [],
  portalCookie,
}: ShopperTopBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const activePortal = profile
    ? resolveActivePortal(portalCookie, profile, pathname)
    : 'patron'

  const avatarProfile = profile
    ? {
        role: profile.role,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      }
    : null

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/discover')
    router.refresh()
  }

  const navLinks = [
    { href: '/discover', label: 'Discover Markets' },
    { href: '/favorites', label: 'Favorites' },
    { href: '/wallet', label: 'Wallet' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)]">
      <div className="mx-auto flex max-w-full flex-col gap-2 overflow-x-hidden px-4 py-3 sm:max-w-7xl sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4 lg:gap-6">
            <Link href="/discover" className="shrink-0">
              <BrandLogoLockup />
            </Link>

            {profile && availablePortals.length > 1 ? (
              <PortalTabs
                availablePortals={availablePortals}
                activePortal={activePortal}
                className="hidden md:inline-flex"
              />
            ) : null}

            <div className="hidden items-center gap-1 md:flex">
              {navLinks.map(({ href, label }) => (
                <Link key={href} href={href}>
                  <Button
                    variant={pathname.startsWith(href) ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 text-sm"
                  >
                    {label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {profile ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button className="min-h-11 min-w-11 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {avatarProfile ? (
                        <UserAvatar
                          userId={profile.id}
                          profile={avatarProfile}
                          className="h-9 w-9"
                          fallbackClassName="text-xs"
                        />
                      ) : null}
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="w-48">
                  <div className="border-b px-3 py-2">
                    <p className="truncate text-sm font-semibold">{profile.full_name}</p>
                  </div>
                  <DropdownMenuItem onClick={() => router.push('/profile')} className="cursor-pointer">
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/wallet')} className="cursor-pointer">
                    Wallet
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block">
                  <Button variant="outline" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="hidden sm:inline-flex">
                    Get started
                  </Button>
                </Link>
              </>
            )}

            <MobileNavSheet
              links={navLinks}
              pathname={pathname}
              side="right"
              className="md:hidden"
              footer={
                !profile ? (
                  <>
                    <Link href="/login">
                      <Button variant="outline" className="w-full min-h-11">
                        Sign in
                      </Button>
                    </Link>
                    <Link href="/signup">
                      <Button className="w-full min-h-11">Get started</Button>
                    </Link>
                  </>
                ) : undefined
              }
            />
          </div>
        </div>

        {profile && availablePortals.length > 1 ? (
          <PortalTabs
            availablePortals={availablePortals}
            activePortal={activePortal}
            compact
            className="w-full md:hidden"
          />
        ) : null}
      </div>
    </header>
  )
}
