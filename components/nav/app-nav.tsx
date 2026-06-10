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
import { getPortalHome, resolveActivePortal } from '@/lib/portals/active-portal'
import { coordinatorNavBackHref } from '@/lib/coordinator/coordinator-event-route'
import type { ActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'
import { useNotificationCount } from '@/hooks/use-notification-count'
import { useFeatureRequest } from '@/components/feedback/feature-request-context'
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
    { href: '/coordinator/dashboard', label: 'Dashboard' },
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
  const pathnameSafe = pathname ?? ''
  const homeHref =
    activePortal === 'coordinator'
      ? coordinatorNavBackHref(pathnameSafe)
      : getPortalHome(activePortal)

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
      className="popup-hub-chrome-header sticky top-0 z-50 overflow-x-hidden border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)] safe-top"
      style={{ minHeight: 'var(--app-nav-height, 5rem)' }}
    >
      <div className="mx-auto flex max-w-full flex-col gap-2 overflow-x-hidden px-4 py-3.5 xl:max-w-[1600px] xl:px-10">
        <CenteredHeaderRow
          left={
            availablePortals.length > 1 ? (
              <PortalTabs
                availablePortals={availablePortals}
                activePortal={activePortal}
                className="hidden lg:inline-flex"
              />
            ) : null
          }
          center={
            <BrandLogoLockup
              className="h-14 w-auto max-h-14 sm:h-16 sm:max-h-16 md:h-18 md:max-h-none"
              href={homeHref}
            />
          }
          right={
            <UserProfileMenu
              links={links}
              pathname={pathname}
              profileName={profile.full_name}
              menuProfile={{ userId: profile.id, profile: avatarProfile }}
              unreadCount={unreadCount}
              onSignOut={handleSignOut}
              extraLinks={menuExtraLinks}
              onSuggestImprovement={openFeatureRequest}
            />
          }
        />

        {links.length > 0 ? (
          <div className="hidden min-w-0 flex-wrap items-center justify-center gap-1 overflow-x-hidden lg:flex xl:gap-2">
            {links.map(({ href, label }) => {
              const active =
                href === '/coordinator/dashboard'
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'shrink-0 rounded-lg px-2 py-2 text-sm font-medium transition-colors lg:px-3',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    active
                      ? 'bg-forest/10 text-forest'
                      : 'text-muted-foreground hover:bg-canvas hover:text-foreground'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        ) : null}

        {availablePortals.length > 1 ? (
          <PortalTabs
            availablePortals={availablePortals}
            activePortal={activePortal}
            compact
            className="w-full lg:hidden"
          />
        ) : null}
      </div>
    </nav>
  )
}
