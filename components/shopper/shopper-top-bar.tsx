'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, User } from 'lucide-react'
import { AppAccountMenuTrigger } from '@/components/nav/app-account-menu-trigger'
import { createClient } from '@/lib/supabase/client'
import { signOutAndRedirectToLogin } from '@/lib/auth/sign-out'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { AppMenuSheet } from '@/components/nav/app-menu-sheet'
import { CenteredHeaderRow } from '@/components/nav/centered-header-row'
import { useAdminPendingCounts } from '@/hooks/use-admin-pending-counts'
import { buildAppMenuExtraLinks } from '@/components/nav/app-menu-extra-links'
import { PortalTabs } from '@/components/nav/portal-tabs'
import {
  GUEST_RIBBON_LINKS,
  PATRON_RIBBON_LINKS,
  SITE_HOME_PATH,
} from '@/components/nav/site-ribbon-links'
import { resolveActivePortal } from '@/lib/portals/active-portal'
import type { ActivePortal } from '@/lib/portals/active-portal'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/types/database'
import { cn } from '@/lib/utils'

interface ShopperTopBarProps {
  profile: Profile | null
  availablePortals?: ActivePortal[]
  portalCookie?: string
  onSuggestImprovement?: () => void
}

function RibbonLinks({
  links,
  pathname,
}: {
  links: { href: string; label: string; title?: string }[]
  pathname: string
}) {
  return (
    <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-1 overflow-x-hidden md:flex lg:gap-2">
      {links.map(({ href, label, title }) => {
        const active =
          href === SITE_HOME_PATH
            ? pathname === SITE_HOME_PATH
            : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            title={title}
            className={cn(
              'shrink-0 rounded-full px-3 py-2 text-sm font-medium transition-colors lg:px-4',
              active
                ? 'bg-forest/10 text-forest font-semibold'
                : 'text-foreground/90 hover:bg-canvas/80 hover:text-foreground'
            )}
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
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

  const { counts: adminPendingCounts } = useAdminPendingCounts(profile?.is_admin === true)

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

  const navLinks = profile ? PATRON_RIBBON_LINKS : GUEST_RIBBON_LINKS

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
    <header
      className="popup-hub-chrome-header sticky top-0 z-50 overflow-x-hidden border-b border-stone-200/70 bg-cream/80 backdrop-blur-lg safe-top"
      style={{ minHeight: 'var(--app-nav-height, 3.25rem)' }}
    >
      <div className="mx-auto flex max-w-full overflow-x-hidden px-4 py-2 sm:px-6 sm:py-2.5 xl:max-w-[1600px] xl:px-10">
        <CenteredHeaderRow
          centerAlign="start"
          left={
            <BrandLogoLockup className="shrink-0" href={SITE_HOME_PATH} />
          }
          center={
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-hidden">
              {profile && availablePortals.length > 1 ? (
                <PortalTabs
                  availablePortals={availablePortals}
                  activePortal={activePortal}
                  compact
                  className="shrink-0"
                />
              ) : null}
              <RibbonLinks links={navLinks} pathname={pathname} />
            </div>
          }
          right={
            profile ? (
              <>
                <AppAccountMenuTrigger
                  menuOpen={menuOpen}
                  onToggle={() => setMenuOpen((open) => !open)}
                  userId={profile.id}
                  profile={avatarProfile!}
                  adminPendingCount={adminPendingCounts.total}
                  mobileClassName="min-h-11 min-w-11"
                  desktopClassName="min-h-11 min-w-11"
                />

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
                  extraLinks={buildAppMenuExtraLinks(profile, adminPendingCounts)}
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
      </div>
    </header>
  )
}
