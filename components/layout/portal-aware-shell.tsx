import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/nav/app-nav'
import { ShopperShell } from '@/components/shopper/shopper-shell'
import { VendorShell } from '@/components/vendor/vendor-shell'
import {
  ACTIVE_PORTAL_COOKIE,
  getAvailablePortals,
  resolveActivePortal,
} from '@/lib/portals/active-portal'
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

  if (profile && portal === 'coordinator' && profile.role === 'coordinator') {
    const availablePortals = getAvailablePortals(profile.role)
    return (
      <div className="market-page min-h-screen max-w-full overflow-x-hidden">
        <AppNav
          profile={profile}
          availablePortals={availablePortals}
          portalCookie={portalCookie}
        />
        <main>{children}</main>
      </div>
    )
  }

  if (profile && portal === 'vendor' && (profile.role === 'vendor' || profile.role === 'coordinator')) {
    return <VendorShell profile={profile}>{children}</VendorShell>
  }

  return <ShopperShell profile={profile}>{children}</ShopperShell>
}
