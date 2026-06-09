'use client'

import { AppNav } from '@/components/nav/app-nav'
import { FeatureRequestProvider } from '@/components/feedback/feature-request-context'
import type { ActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'

interface SharedLayoutChromeProps {
  profile: Profile
  availablePortals: ActivePortal[]
  portalCookie?: string
  children: React.ReactNode
}

export function SharedLayoutChrome({
  profile,
  availablePortals,
  portalCookie,
  children,
}: SharedLayoutChromeProps) {
  return (
    <FeatureRequestProvider profile={profile} portalCookie={portalCookie}>
      <div className="market-page min-h-screen">
        <AppNav profile={profile} availablePortals={availablePortals} portalCookie={portalCookie} />
        <main>{children}</main>
      </div>
    </FeatureRequestProvider>
  )
}
