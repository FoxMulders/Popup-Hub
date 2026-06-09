'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signOutAndRedirectToLogin } from '@/lib/auth/sign-out'
import { UserAvatar } from '@/components/profile/user-avatar'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { AppMenuSheet } from '@/components/nav/app-menu-sheet'
import { PortalTabs } from '@/components/nav/portal-tabs'
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
  const unreadCount = useNotificationCount(profile.id)
  const { open: openFeatureRequest } = useFeatureRequest()

  const activePortal = resolveActivePortal(portalCookie, profile, pathname)
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

  const menuExtraLinks = [
    { href: '/profile', label: 'Profile settings' },
    ...(profile.is_admin ? [{ href: '/admin/feedback', label: 'Feature requests' }] : []),
  ]

  return (
    <nav
      id="site-app-nav"
      className="popup-hub-chrome-header sticky top-0 z-50 border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)] safe-top"
      style={{ minHeight: 'var(--app-nav-height, 4.5rem)' }}
    >
      <div className="mx-auto flex max-w-full flex-col gap-2 overflow-x-hidden px-4 py-3 xl:max-w-[1600px] xl:px-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4 lg:gap-6">
            <BrandLogoLockup className="shrink-0" href={homeHref} />

            {availablePortals.length > 1 ? (
              <div className="hidden shrink-0 items-center gap-4 sm:flex">
                <PortalTabs
                  availablePortals={availablePortals}
                  activePortal={activePortal}
                />
                {links.length > 0 ? (
                  <div
                    className="hidden h-7 w-px shrink-0 bg-stone-300/80 md:block"
                    aria-hidden
                  />
                ) : null}
              </div>
            ) : null}

            {links.length > 0 ? (
              <div className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex md:pl-1">
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
                        'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openFeatureRequest}
              className="hidden rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-canvas hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:inline-flex lg:items-center lg:gap-1.5"
            >
              <span aria-hidden>💡</span>
              <span>Suggest an Improvement</span>
            </button>

            <AppMenuSheet
              links={links}
              pathname={pathname}
              profileName={profile.full_name}
              unreadCount={unreadCount}
              onSignOut={handleSignOut}
              extraLinks={menuExtraLinks}
              onSuggestImprovement={openFeatureRequest}
            />

            <Link
              href="/profile"
              className="app-tap-target rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Profile settings"
            >
              <UserAvatar
                userId={profile.id}
                profile={avatarProfile}
                className="h-9 w-9"
                fallbackClassName="text-xs"
              />
            </Link>
          </div>
        </div>

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
