'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signOutAndRedirectToLogin } from '@/lib/auth/sign-out'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { CenteredHeaderRow } from '@/components/nav/centered-header-row'
import { buildAppMenuExtraLinks } from '@/components/nav/app-menu-extra-links'
import { PortalTabs } from '@/components/nav/portal-tabs'
import { UserProfileMenu } from '@/components/nav/user-profile-menu'
import { resolveActivePortal } from '@/lib/portals/active-portal'
import type { ActivePortal } from '@/lib/portals/active-portal'
import { Button } from '@/components/ui/button'
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

  const guestFooter = (
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
  )

  return (
    <header className="sticky top-0 z-50 overflow-x-hidden border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)] safe-top">
      <div className="mx-auto flex max-w-full flex-col gap-2 overflow-x-hidden px-4 py-3.5 sm:max-w-7xl sm:px-6">
        <CenteredHeaderRow
          left={
            profile && availablePortals.length > 1 ? (
              <PortalTabs
                availablePortals={availablePortals}
                activePortal={activePortal}
                className="hidden sm:inline-flex"
              />
            ) : null
          }
          center={
            <BrandLogoLockup
              className="h-14 w-auto max-h-14 sm:h-16 sm:max-h-16 md:h-18 md:max-h-none"
              href="/discover"
            />
          }
          right={
            <>
              {!profile ? (
                <div className="hidden items-center gap-2 md:flex">
                  <Link href="/login">
                    <Button variant="outline" size="sm" className="min-h-9">
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="sm" className="min-h-9">
                      Get started
                    </Button>
                  </Link>
                </div>
              ) : null}

              <UserProfileMenu
                links={navLinks}
                pathname={pathname}
                profileName={profile?.full_name}
                menuProfile={
                  profile && avatarProfile
                    ? { userId: profile.id, profile: avatarProfile }
                    : undefined
                }
                onSignOut={profile ? signOut : undefined}
                extraLinks={profile ? buildAppMenuExtraLinks(profile) : undefined}
                onSuggestImprovement={onSuggestImprovement}
                footer={profile ? undefined : guestFooter}
                guest={!profile}
              />
            </>
          }
        />

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
