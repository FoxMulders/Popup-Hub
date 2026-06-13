'use client'

import { AppNav } from '@/components/nav/app-nav'
import { FeatureRequestProvider } from '@/components/feedback/feature-request-context'
import type { ActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'

interface ShopperLayoutChromeProps {
  profile: Profile
  availablePortals: ActivePortal[]
  portalCookie?: string
  children: React.ReactNode
}

export function ShopperLayoutChrome({
  profile,
  availablePortals,
  portalCookie,
  children,
}: ShopperLayoutChromeProps) {
  return (
    <FeatureRequestProvider profile={profile} portalCookie={portalCookie}>
      <div className="flex min-h-0 flex-1 flex-col bg-cream">
        <AppNav profile={profile} availablePortals={availablePortals} portalCookie={portalCookie} />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </FeatureRequestProvider>
  )
}
