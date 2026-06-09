'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signOutAndRedirectToLogin } from '@/lib/auth/sign-out'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { AppMenuSheet } from '@/components/nav/app-menu-sheet'
import { PortalTabs } from '@/components/nav/portal-tabs'
import { resolveActivePortal } from '@/lib/portals/active-portal'
import type { ActivePortal } from '@/lib/portals/active-portal'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/profile/user-avatar'
import type { Profile } from '@/types/database'

interface ShopperTopBarProps {
  profile: Profile | null
  availablePortals?: ActivePortal[]
  portalCookie?: string
  onSuggestImprovement?: () => void
}

export function ShopperTopBar({
  profile,
  availablePortals = [],
  portalCookie,
  onSuggestImprovement,
}: ShopperTopBarProps) {
  const pathname = usePathname()
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
    await signOutAndRedirectToLogin(supabase)
  }

  const navLinks = [
    { href: '/discover', label: 'Discover Markets' },
    { href: '/favorites', label: 'Favorites' },
    { href: '/wallet', label: 'Wallet' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)] safe-top">
      <div className="mx-auto flex max-w-full flex-col gap-2 overflow-x-hidden px-4 py-3 sm:max-w-7xl sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4 lg:gap-6">
            <BrandLogoLockup className="shrink-0" href="/discover" />

            {profile && availablePortals.length > 1 ? (
              <PortalTabs
                availablePortals={availablePortals}
                activePortal={activePortal}
                className="hidden sm:inline-flex"
              />
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {profile ? (
              <>
                <AppMenuSheet
                  links={navLinks}
                  pathname={pathname}
                  profileName={profile.full_name}
                  onSignOut={signOut}
                  extraLinks={[{ href: '/profile', label: 'Profile settings' }]}
                  onSuggestImprovement={onSuggestImprovement}
                />
                <Link
                  href="/profile"
                  className="app-tap-target rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Profile settings"
                >
                  {avatarProfile ? (
                    <UserAvatar
                      userId={profile.id}
                      profile={avatarProfile}
                      className="h-9 w-9"
                      fallbackClassName="text-xs"
                    />
                  ) : null}
                </Link>
              </>
            ) : (
              <AppMenuSheet
                links={navLinks}
                pathname={pathname}
                footer={
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
                }
              />
            )}
          </div>
        </div>

        {profile && availablePortals.length > 1 ? (
          <PortalTabs
            availablePortals={availablePortals}
            activePortal={activePortal}
            compact
            className="w-full sm:hidden"
          />
        ) : null}
      </div>
    </header>
  )
}
