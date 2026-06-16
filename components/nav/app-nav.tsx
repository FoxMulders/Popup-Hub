'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Bell, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { signOutAndRedirectToLogin } from '@/lib/auth/sign-out'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { AppMenuSheet } from '@/components/nav/app-menu-sheet'
import { CenteredHeaderRow } from '@/components/nav/centered-header-row'
import { buildAppMenuExtraLinks } from '@/components/nav/app-menu-extra-links'
import { PortalTabs } from '@/components/nav/portal-tabs'
import { resolveActivePortal } from '@/lib/portals/active-portal'
import type { ActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'
import { useNotificationCount } from '@/hooks/use-notification-count'
import { useFeatureRequest } from '@/components/feedback/feature-request-context'
import { LayoutEditorHelpButton } from '@/components/coordinator/floor-plan-v2/tools/layout-editor-help'
import { Badge } from '@/components/ui/badge'
import { isCoordinatorLayoutHelpNavRoute } from '@/lib/nav/coordinator-layout-help-nav'
import {
  COORDINATOR_HOME_PATH,
  COORDINATOR_MARKETS_PATH,
  COORDINATOR_STUDIO_PATH,
  isCoordinatorStudioPath,
} from '@/lib/coordinator/coordinator-routes'
import { cn } from '@/lib/utils'

interface AppNavProps {
  profile: Profile
  availablePortals?: ActivePortal[]
  portalCookie?: string
  /** @deprecated Use pathname detection instead */
  vendorPortal?: boolean
}

const NAV_LINKS: Record<string, { href: string; label: string }[]> = {
  patron: [
    { href: '/discover', label: 'Discover Markets' },
    { href: '/favorites', label: 'Favorites' },
    { href: '/supplies', label: 'Market Supplies' },
    { href: '/wallet', label: 'Wallet' },
  ],
  vendor: [
    { href: '/vendor/dashboard', label: 'Dashboard' },
    { href: '/vendor/passport', label: 'My Passport' },
    { href: '/vendor/supplies', label: 'Vendor Supplies' },
    { href: '/vendor/events', label: 'Apply for open markets' },
    { href: '/vendor/applications', label: 'My Applications' },
    { href: '/wallet', label: 'Wallet' },
  ],
  coordinator: [
    { href: COORDINATOR_HOME_PATH, label: 'Home' },
    { href: COORDINATOR_MARKETS_PATH, label: 'Markets' },
    { href: COORDINATOR_STUDIO_PATH, label: 'Blueprint Studio' },
    { href: '/coordinator/events/new', label: 'New Event' },
    { href: '/wallet', label: 'Wallet' },
  ],
}

export function AppNav({
  profile,
  availablePortals = [],
  portalCookie,
  vendorPortal = false,
}: AppNavProps) {
  const pathname = usePathname()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const activePortal = resolveActivePortal(portalCookie, profile, pathname)
  const unreadCount = useNotificationCount(profile.id, activePortal)
  const { open: openFeatureRequest } = useFeatureRequest()
  const navRole =
    activePortal === 'coordinator'
      ? 'coordinator'
      : activePortal === 'vendor' || vendorPortal
        ? 'vendor'
        : 'patron'
  const links = NAV_LINKS[navRole] ?? []
  const showLayoutHelpInNav =
    navRole === 'coordinator' && isCoordinatorLayoutHelpNavRoute(pathname)
  const homeHref = '/'

  async function handleSignOut() {
    await signOutAndRedirectToLogin(supabase)
  }

  const avatarProfile = {
    role: profile.role,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  }

  const menuExtraLinks = buildAppMenuExtraLinks(profile)

  return (
    <nav
      id="site-app-nav"
      className="popup-hub-chrome-header sticky top-0 z-50 overflow-x-hidden border-b border-stone-200/70 bg-cream/80 backdrop-blur-lg safe-top"
      style={{ minHeight: 'var(--app-nav-height, 3.625rem)' }}
    >
      <div className="mx-auto flex max-w-full flex-col gap-1 overflow-x-hidden px-4 py-3.5 sm:px-6 xl:max-w-[1600px] xl:px-10">
        <CenteredHeaderRow
          left={
            <BrandLogoLockup
              className="shrink-0"
              href={homeHref}
            />
          }
          center={
            <>
              {availablePortals.length > 1 ? (
                <div className="hidden shrink-0 items-center gap-2 sm:flex md:gap-3">
                  <PortalTabs
                    availablePortals={availablePortals}
                    activePortal={activePortal}
                  />
                  {links.length > 0 ? (
                    <div
                      className="hidden h-6 w-px shrink-0 bg-stone-300/80 md:block"
                      aria-hidden
                    />
                  ) : null}
                </div>
              ) : null}

              {links.length > 0 ? (
                <div className="hidden min-w-0 flex-wrap items-center justify-center gap-0.5 overflow-x-hidden md:flex lg:gap-1">
                  {links.map(({ href, label }) => {
                    const active =
                      href === COORDINATOR_HOME_PATH
                        ? pathname === COORDINATOR_HOME_PATH
                        : href === COORDINATOR_STUDIO_PATH
                          ? isCoordinatorStudioPath(pathname)
                          : pathname === href || pathname.startsWith(`${href}/`)
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          'shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors lg:px-3.5',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          active
                            ? 'bg-forest text-white shadow-sm'
                            : 'text-stone-800 hover:bg-stone-100 hover:text-forest'
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        {label}
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </>
          }
          right={
            <>
              {showLayoutHelpInNav ? (
                <LayoutEditorHelpButton
                  variant="prominent"
                  size="sm"
                  className="h-8 shrink-0 px-2.5 text-xs shadow-sm sm:px-3"
                />
              ) : null}

              <Link
                href="/notifications"
                className="relative app-tap-target inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-muted-foreground hover:bg-canvas hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={
                  unreadCount > 0
                    ? `${unreadCount} unread notifications`
                    : 'Notifications'
                }
              >
                <Bell className="h-4 w-4" aria-hidden />
                {unreadCount > 0 ? (
                  <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px] leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                ) : null}
              </Link>

              <button
                type="button"
                className="app-tap-target flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Menu className="h-5 w-5 text-foreground" />
              </button>

              <AppMenuSheet
                open={menuOpen}
                onOpenChange={setMenuOpen}
                links={links}
                pathname={pathname}
                profileName={profile.full_name}
                menuProfile={{ userId: profile.id, profile: avatarProfile }}
                unreadCount={unreadCount}
                onSignOut={handleSignOut}
                extraLinks={menuExtraLinks}
                onSuggestImprovement={openFeatureRequest}
              />
            </>
          }
        />

        {availablePortals.length > 1 ? (
          <PortalTabs
            availablePortals={availablePortals}
            activePortal={activePortal}
            compact
            className="w-full sm:hidden"
          />
        ) : null}
      </div>
    </nav>
  )
}
