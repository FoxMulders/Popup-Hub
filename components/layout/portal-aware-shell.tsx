import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ShopperShell } from '@/components/shopper/shopper-shell'
import { PortalSiteChrome } from '@/components/layout/portal-site-chrome'
import { VendorShell } from '@/components/vendor/vendor-shell'
import {
  ACTIVE_PORTAL_COOKIE,
  getAvailablePortals,
  resolveActivePortal,
} from '@/lib/portals/active-portal'
import { canActAsCoordinator, canActAsVendor } from '@/lib/auth/rbac'
import type { Profile } from '@/types/database'

interface PortalAwareShellProps {
  children: React.ReactNode
}

export async function PortalAwareShell({ children }: PortalAwareShellProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: Profile | null = null

  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data as Profile | null
  }

  const cookieStore = await cookies()
  const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value
  const portal = resolveActivePortal(portalCookie, profile)

  if (profile && portal === 'coordinator' && canActAsCoordinator(profile)) {
    const availablePortals = getAvailablePortals(profile.role, { isAdmin: profile.is_admin })
    return (
      <PortalSiteChrome
        portal="coordinator"
        profile={profile}
        availablePortals={availablePortals}
        portalCookie={portalCookie}
      >
        {children}
      </PortalSiteChrome>
    )
  }

  if (profile && portal === 'vendor' && canActAsVendor(profile)) {
    return <VendorShell profile={profile}>{children}</VendorShell>
  }

  return <ShopperShell profile={profile}>{children}</ShopperShell>
}
