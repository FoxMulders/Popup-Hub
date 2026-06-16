'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, User } from 'lucide-react'
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
    <header className="sticky top-0 z-50 overflow-x-hidden border-b border-stone-200/70 bg-cream/80 backdrop-blur-lg safe-top">
      <div className="mx-auto flex max-w-full flex-col gap-2 overflow-x-hidden px-4 py-3.5 sm:max-w-7xl sm:px-6">
        <CenteredHeaderRow
          left={
            <BrandLogoLockup className="shrink-0" href="/discover" />
          }
          center={
            profile && availablePortals.length > 1 ? (
              <PortalTabs
                availablePortals={availablePortals}
                activePortal={activePortal}
                className="hidden sm:inline-flex"
              />
            ) : null
          }
          right={
            profile ? (
              <>
                <button
                  type="button"
                  className="app-tap-target flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <Menu className="h-5 w-5 text-foreground" />
                </button>

                <AppMenuSheet
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  links={navLinks}
                  pathname={pathname}
                  profileName={profile.full_name}
                  menuProfile={
                    avatarProfile
                      ? { userId: profile.id, profile: avatarProfile }
                      : undefined
                  }
                  onSignOut={signOut}
                  extraLinks={buildAppMenuExtraLinks(profile)}
                  onSuggestImprovement={onSuggestImprovement}
                />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="app-tap-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                  aria-label="Sign in"
                >
                  <User className="h-5 w-5 text-foreground" aria-hidden />
                </Link>

                <div className="hidden items-center gap-2 md:flex">
                  <Link href="/login">
                    <Button variant="outline" size="sm" className="min-h-9 rounded-full px-4">
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="sm" className="min-h-9 rounded-full px-5">
                      Get started
                    </Button>
                  </Link>
                </div>

                <button
                  type="button"
                  className="app-tap-target flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                  aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <Menu className="h-5 w-5 text-foreground" />
                </button>

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
