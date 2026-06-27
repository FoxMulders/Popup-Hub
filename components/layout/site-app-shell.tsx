'use client'

import type { ReactNode } from 'react'
import { AppNav } from '@/components/nav/app-nav'
import { FeatureRequestProvider } from '@/components/feedback/feature-request-context'
import { VendorBottomNav } from '@/components/vendor/vendor-bottom-nav'
import { PageBackBar } from '@/components/navigation/page-back-bar'
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
    >
      <div
        className={cn(
          'market-page site-app-shell site-surface flex max-w-full flex-col overflow-x-hidden',
          viewportFill ? 'h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden' : 'min-h-0 flex-1'
        )}
      >
        <AppNav
          profile={profile}
          availablePortals={availablePortals}
          portalCookie={portalCookie}
          vendorPortal={vendorPortal}
        />
        {!viewportFill ? <PageBackBar /> : null}
        <main
          id="site-main"
          className={
            viewportFill
              ? 'min-h-0 flex-1 overflow-hidden'
              : cn(
                  'site-main-gutter w-full max-w-full overflow-x-hidden',
                  vendorPortal &&
                    'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0'
                )
          }
        >
          {children}
        </main>
        {vendorPortal ? <VendorBottomNav /> : null}
      </div>
    </FeatureRequestProvider>
  )
}
