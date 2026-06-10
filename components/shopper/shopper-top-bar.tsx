'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { signOutAndRedirectToLogin } from '@/lib/auth/sign-out'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { AppMenuSheet } from '@/components/nav/app-menu-sheet'
import { CenteredHeaderRow } from '@/components/nav/centered-header-row'
import { buildAppMenuExtraLinks } from '@/components/nav/app-menu-extra-links'
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
  const [menuOpen, setMenuOpen] = useState(false)

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
    <header className="sticky top-0 z-50 border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)] safe-top">
      <div className="mx-auto flex max-w-full flex-col gap-2 overflow-x-hidden px-4 py-3 sm:max-w-7xl sm:px-6">
        <CenteredHeaderRow
          left={
            <>
              <div className="hidden w-[7rem] shrink-0 sm:block" aria-hidden />
              {profile && availablePortals.length > 1 ? (
                <PortalTabs
                  availablePortals={availablePortals}
                  activePortal={activePortal}
                  className="hidden sm:inline-flex"
                />
              ) : null}
            </>
          }
          center={<BrandLogoLockup className="shrink-0" href="/discover" />}
          right={
            profile ? (
              <>
                <button
                  type="button"
                  className="app-tap-target rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                  aria-label="Open navigation menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(true)}
                >
                  {avatarProfile ? (
                    <UserAvatar
                      userId={profile.id}
                      profile={avatarProfile}
                      className="h-9 w-9"
                      fallbackClassName="text-xs"
                    />
                  ) : null}
                </button>

                <Link
                  href="/profile"
                  className="app-tap-target hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
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

                <AppMenuSheet
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  links={navLinks}
                  pathname={pathname}
                  profileName={profile.full_name}
                  onSignOut={signOut}
                  extraLinks={buildAppMenuExtraLinks(profile)}
                  onSuggestImprovement={onSuggestImprovement}
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="app-tap-target flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                  aria-label="Open navigation menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(true)}
                >
                  <User className="h-5 w-5 text-foreground" />
                </button>

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

                <AppMenuSheet
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  links={navLinks}
                  pathname={pathname}
                  footer={guestFooter}
                />
              </>
            )
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
