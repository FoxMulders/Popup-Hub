'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import { AppAccountMenuTrigger } from '@/components/nav/app-account-menu-trigger'
import { createClient } from '@/lib/supabase/client'
import { signOutAndRedirectToLogin } from '@/lib/auth/sign-out'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { AppMenuSheet } from '@/components/nav/app-menu-sheet'
import { buildAppMenuExtraLinks } from '@/components/nav/app-menu-extra-links'
import { PortalTabs } from '@/components/nav/portal-tabs'
import { resolveActivePortal } from '@/lib/portals/active-portal'
import type { ActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'
import { useNotificationCount } from '@/hooks/use-notification-count'
import { useAdminPendingCounts } from '@/hooks/use-admin-pending-counts'
import { useFeatureRequest } from '@/components/feedback/feature-request-context'
import { useCoordinatorMarketMenuLinks } from '@/hooks/use-coordinator-market-menu-links'
import { useIsMobileNav } from '@/hooks/use-is-mobile-nav'
import { LayoutEditorHelpButton } from '@/components/coordinator/floor-plan-v2/tools/layout-editor-help'
import { Badge } from '@/components/ui/badge'
import { isCoordinatorLayoutHelpNavRoute } from '@/lib/nav/coordinator-layout-help-nav'
import {
  COORDINATOR_HOME_PATH,
  COORDINATOR_STUDIO_PATH,
  coordinatorHubGridNavHref,
  isCoordinatorStudioPath,
} from '@/lib/coordinator/coordinator-routes'
import { cn } from '@/lib/utils'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'
import { SITE_HOME_PATH } from '@/lib/nav/site-home'

interface AppNavProps {
  profile: Profile
  availablePortals?: ActivePortal[]
  portalCookie?: string
  /** @deprecated Use pathname detection instead */
  vendorPortal?: boolean
}

type NavLink = { href: string; label: string; title?: string }

function buildNavLinks(navRole: string, mobile: boolean): NavLink[] {
  const walletLabel = 'PopupFunds'

  if (navRole === 'patron') {
    return [
      { href: SITE_HOME_PATH, label: 'Home' },
      { href: '/discover', label: 'Discover Markets' },
      { href: '/favorites', label: 'Favorites' },
      { href: '/supplies', label: 'Market Supplies' },
      { href: '/wallet', label: walletLabel },
    ]
  }

  if (navRole === 'vendor') {
    return [
      { href: SITE_HOME_PATH, label: 'Home' },
      { href: '/vendor/dashboard', label: 'Dashboard' },
      { href: '/vendor/passport', label: 'My Passport' },
      { href: '/vendor/supplies', label: 'Vendor Supplies' },
      { href: '/vendor/events', label: 'Apply for open markets' },
      {
        href: TRUST_DIRECTORY_LINKS.check.href,
        label: TRUST_DIRECTORY_LINKS.check.navLabel,
        title: `${TRUST_DIRECTORY_LINKS.check.label} — ${TRUST_DIRECTORY_LINKS.check.tagline}`,
      },
      { href: '/vendor/applications', label: 'My Applications' },
      { href: '/wallet', label: walletLabel },
    ]
  }

  if (navRole === 'coordinator') {
    return [
      { href: COORDINATOR_HOME_PATH, label: 'Home' },
      {
        href: coordinatorHubGridNavHref({ mobile }),
        label: 'HubGrid',
      },
      { href: '/coordinator/events/new', label: 'New Event' },
      { href: '/wallet', label: walletLabel },
    ]
  }

  return []
}

function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === SITE_HOME_PATH) return pathname === SITE_HOME_PATH
  if (href === COORDINATOR_HOME_PATH) return pathname === COORDINATOR_HOME_PATH
  if (href === COORDINATOR_STUDIO_PATH || href.startsWith(`${COORDINATOR_STUDIO_PATH}?`)) {
    return isCoordinatorStudioPath(pathname)
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function DesktopNavLinks({
  links,
  pathname,
}: {
  links: NavLink[]
  pathname: string
}) {
  if (links.length === 0) return null

  return (
    <div className="hidden min-w-0 flex-nowrap items-center justify-center gap-0.5 overflow-x-auto md:flex lg:gap-1">
      {links.map(({ href, label, title }) => {
        const active = isNavLinkActive(pathname, href)
        return (
          <Link
            key={`${href}-${label}`}
            href={href}
            title={title}
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
  )
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
  const mobile = useIsMobileNav()
  const activePortal = resolveActivePortal(portalCookie, profile, pathname)
  const unreadCount = useNotificationCount(profile.id, activePortal)
  const { counts: adminPendingCounts } = useAdminPendingCounts(profile.is_admin === true)
  const { open: openFeatureRequest } = useFeatureRequest()
  const navRole =
    activePortal === 'coordinator'
      ? 'coordinator'
      : activePortal === 'vendor' || vendorPortal
        ? 'vendor'
        : 'patron'
  const links = useMemo(() => buildNavLinks(navRole, mobile), [navRole, mobile])
  const marketMenuLinks = useCoordinatorMarketMenuLinks(navRole === 'coordinator')
  const showLayoutHelpInNav =
    navRole === 'coordinator' && isCoordinatorLayoutHelpNavRoute(pathname)
  const homeHref = SITE_HOME_PATH
  const stackedHeader = availablePortals.length > 1

  async function handleSignOut() {
    await signOutAndRedirectToLogin(supabase)
  }

  const avatarProfile = {
    role: profile.role,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  }

  const menuExtraLinks = buildAppMenuExtraLinks(profile, adminPendingCounts)

  const rightActions = (
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
          unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'
        }
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unreadCount > 0 ? (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px] leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        ) : null}
      </Link>

      <AppAccountMenuTrigger
        menuOpen={menuOpen}
        onToggle={() => setMenuOpen((open) => !open)}
        userId={profile.id}
        profile={avatarProfile}
        adminPendingCount={adminPendingCounts.total}
      />

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
        marketLinks={marketMenuLinks}
        onSuggestImprovement={openFeatureRequest}
      />
    </>
  )

  return (
    <nav
      id="site-app-nav"
      className={cn(
        'popup-hub-chrome-header sticky top-0 z-50 overflow-x-hidden border-b border-stone-200/70 bg-cream/80 backdrop-blur-lg safe-top',
        stackedHeader && 'app-nav--stacked'
      )}
      style={{
        minHeight: stackedHeader
          ? 'var(--app-nav-height-stacked, 5.5rem)'
          : 'var(--app-nav-height, 3.25rem)',
      }}
    >
      <div className="mx-auto flex max-w-full flex-col gap-2 overflow-x-hidden px-4 py-2 sm:px-6 sm:py-2.5 xl:max-w-[1600px] xl:px-10">
        {stackedHeader ? (
          <>
            <div className="flex w-full min-w-0 items-center justify-between gap-2">
              <BrandLogoLockup className="min-w-0 shrink" href={homeHref} />
              <div className="flex shrink-0 items-center justify-end gap-2 overflow-x-hidden">
                {rightActions}
              </div>
            </div>
            <div className="flex w-full min-w-0 items-center gap-2 overflow-x-hidden">
              <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <PortalTabs
                  availablePortals={availablePortals}
                  activePortal={activePortal}
                  compact
                />
              </div>
              <DesktopNavLinks links={links} pathname={pathname} />
            </div>
          </>
        ) : (
          <div className="grid w-full min-w-0 grid-cols-[auto_1fr_auto] items-center gap-2 overflow-x-hidden sm:gap-3">
            <div className="justify-self-start shrink-0">
              <BrandLogoLockup className="shrink-0" href={homeHref} />
            </div>
            <div className="flex min-w-0 items-center justify-start gap-2 overflow-x-hidden sm:gap-3">
              <DesktopNavLinks links={links} pathname={pathname} />
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 overflow-x-hidden">
              {rightActions}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
