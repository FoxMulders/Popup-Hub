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
      <div className="market-page site-surface flex min-h-0 flex-1 flex-col">
        <AppNav profile={profile} availablePortals={availablePortals} portalCookie={portalCookie} />
        <main className="flex-1">{children}</main>
      </div>
    </FeatureRequestProvider>
  )
}
