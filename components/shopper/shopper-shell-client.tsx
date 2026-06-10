'use client'

import { ShopperTopBar } from '@/components/shopper/shopper-top-bar'
import { ShopperBottomNav } from '@/components/shopper/shopper-bottom-nav'
import { FeatureRequestProvider, useFeatureRequest } from '@/components/feedback/feature-request-context'
import type { ActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'

interface ShopperShellClientProps {
  children: React.ReactNode
  hideBottomNav?: boolean
  profile: Profile | null
  availablePortals: ActivePortal[]
  portalCookie?: string
}

function ShopperShellInner({
  children,
  hideBottomNav,
  profile,
  availablePortals,
  portalCookie,
}: ShopperShellClientProps) {
  const { open } = useFeatureRequest()

  return (
    <div className="site-app-shell market-page flex min-h-screen flex-col bg-cream max-w-full overflow-x-hidden">
      <ShopperTopBar
        profile={profile}
        availablePortals={availablePortals}
        portalCookie={portalCookie}
        onSuggestImprovement={open}
      />
      <main
        id="site-main"
        className="w-full max-w-full flex-1 overflow-x-hidden pb-[calc(2rem+env(safe-area-inset-bottom))] md:pb-0"
      >
        {children}
      </main>
      <ShopperBottomNav hide={hideBottomNav} />
    </div>
  )
}

export function ShopperShellClient({
  children,
  hideBottomNav,
  profile,
  availablePortals,
  portalCookie,
}: ShopperShellClientProps) {
  if (!profile) {
    return (
      <div className="site-app-shell market-page flex min-h-screen flex-col bg-cream max-w-full overflow-x-hidden">
        <ShopperTopBar
          profile={profile}
          availablePortals={availablePortals}
          portalCookie={portalCookie}
        />
        <main
          id="site-main"
          className="w-full max-w-full flex-1 overflow-x-hidden pb-[calc(2rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {children}
        </main>
        <ShopperBottomNav hide={hideBottomNav} />
      </div>
    )
  }

  return (
    <FeatureRequestProvider profile={profile} portalCookie={portalCookie}>
      <ShopperShellInner
        hideBottomNav={hideBottomNav}
        profile={profile}
        availablePortals={availablePortals}
        portalCookie={portalCookie}
      >
        {children}
      </ShopperShellInner>
    </FeatureRequestProvider>
  )
}
