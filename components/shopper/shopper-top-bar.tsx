'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { MobileNavSheet } from '@/components/nav/mobile-nav-sheet'
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
import { PortalSwitcherMenuItems } from '@/components/nav/portal-switcher'
import type { Profile } from '@/types/database'

interface ShopperTopBarProps {
  profile: Profile | null
  vendorAccessCount?: number
}

export function ShopperTopBar({ profile, vendorAccessCount = 0 }: ShopperTopBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

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
      <div className="mx-auto flex max-w-full items-center justify-between overflow-x-hidden px-4 py-3 sm:max-w-7xl sm:px-6">
        <Link href="/discover" className="shrink-0">
          <BrandLogoLockup />
        </Link>

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

        <div className="flex items-center gap-2">
          {profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="h-9 w-9 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
                <PortalSwitcherMenuItems
                  hasVendorAccess={vendorAccessCount > 0}
                  currentPortal="markets"
                />
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
    </header>
  )
}
