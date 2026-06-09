'use client'

import type { ReactNode } from 'react'
import { AppNav } from '@/components/nav/app-nav'
import { FeatureRequestProvider } from '@/components/feedback/feature-request-context'
import { cn } from '@/lib/utils'
import type { ActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'

export interface SiteAppShellProps {
  profile: Profile
  availablePortals: ActivePortal[]
  portalCookie?: string
  children: ReactNode
  /** When true, main fills viewport below nav (command-center routes). */
  viewportFill?: boolean
  vendorPortal?: boolean
}

/**
 * Unified authenticated app chrome for coordinator, vendor, and portal-aware routes.
 */
export function SiteAppShell({
  profile,
  availablePortals,
  portalCookie,
  children,
  viewportFill = false,
  vendorPortal = false,
}: SiteAppShellProps) {
  return (
    <FeatureRequestProvider
      profile={profile}
      portalCookie={portalCookie}
      hideFab={viewportFill}
    >
      <div
        className={cn(
          'market-page site-app-shell flex max-w-full flex-col overflow-x-hidden',
          viewportFill ? 'h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden' : 'min-h-screen'
        )}
      >
        <AppNav
          profile={profile}
          availablePortals={availablePortals}
          portalCookie={portalCookie}
          vendorPortal={vendorPortal}
        />
        <main
          id="site-main"
          className={
            viewportFill
              ? 'min-h-0 flex-1 overflow-hidden'
              : 'w-full max-w-full flex-1 overflow-x-hidden'
          }
        >
          {children}
        </main>
      </div>
    </FeatureRequestProvider>
  )
}
