'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserAvatar } from '@/components/profile/user-avatar'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { AppMenuSheet } from '@/components/nav/app-menu-sheet'
import { PortalTabs } from '@/components/nav/portal-tabs'
import { getPortalHome, resolveActivePortal } from '@/lib/portals/active-portal'
import type { ActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'
import { useNotificationCount } from '@/hooks/use-notification-count'

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
    { href: '/wallet', label: 'Wallet' },
  ],
  vendor: [
    { href: '/vendor/dashboard', label: 'Dashboard' },
    { href: '/vendor/passport', label: 'My Passport' },
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
  const router = useRouter()
  const supabase = createClient()
  const unreadCount = useNotificationCount(profile.id)

  const activePortal = resolveActivePortal(portalCookie, profile, pathname)
  const navRole =
    activePortal === 'coordinator'
      ? 'coordinator'
      : activePortal === 'vendor' || vendorPortal
        ? 'vendor'
        : 'patron'
  const links = NAV_LINKS[navRole] ?? []
  const homeHref = getPortalHome(activePortal)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const avatarProfile = {
    role: profile.role,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  }

  const menuExtraLinks = [{ href: '/profile', label: 'Profile settings' }]

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)] safe-top">
      <div className="mx-auto flex max-w-full flex-col gap-2 overflow-x-hidden px-4 py-3 xl:max-w-[1600px] xl:px-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4 lg:gap-6">
            <Link href={homeHref} className="shrink-0">
              <BrandLogoLockup />
            </Link>

            {availablePortals.length > 1 ? (
              <PortalTabs
                availablePortals={availablePortals}
                activePortal={activePortal}
                className="hidden sm:inline-flex"
              />
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <AppMenuSheet
              links={links}
              pathname={pathname}
              profileName={profile.full_name}
              unreadCount={unreadCount}
              onSignOut={handleSignOut}
              extraLinks={menuExtraLinks}
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
