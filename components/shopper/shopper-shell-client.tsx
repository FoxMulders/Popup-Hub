'use client'

import { ShopperTopBar } from '@/components/shopper/shopper-top-bar'
import { ShopperBottomNav } from '@/components/shopper/shopper-bottom-nav'
import { PageBackBar } from '@/components/navigation/page-back-bar'
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
    <div className="site-app-shell market-page site-surface flex min-h-0 flex-1 flex-col max-w-full overflow-x-hidden">
      <ShopperTopBar
        profile={profile}
        availablePortals={availablePortals}
        portalCookie={portalCookie}
        onSuggestImprovement={open}
      />
      <PageBackBar />
      <main
        id="site-main"
        className="site-main-gutter w-full max-w-full overflow-x-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
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
      <div className="site-app-shell market-page site-surface flex min-h-0 flex-1 flex-col max-w-full overflow-x-hidden">
        <ShopperTopBar
          profile={profile}
          availablePortals={availablePortals}
          portalCookie={portalCookie}
        />
        <PageBackBar />
        <main
          id="site-main"
          className="site-main-gutter w-full max-w-full overflow-x-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
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
