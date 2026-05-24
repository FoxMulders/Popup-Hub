import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ShopperTopBar } from '@/components/shopper/shopper-top-bar'
import { ShopperBottomNav } from '@/components/shopper/shopper-bottom-nav'
import {
  ACTIVE_PORTAL_COOKIE,
  getAvailablePortals,
} from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'

interface ShopperShellProps {
  children: React.ReactNode
  hideBottomNav?: boolean
  profile?: Profile | null
}

export async function ShopperShell({ children, hideBottomNav, profile: profileProp }: ShopperShellProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile = profileProp ?? null
  if (!profile && user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data as Profile | null
  }

  const cookieStore = await cookies()
  const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value
  const availablePortals = profile ? getAvailablePortals(profile.role) : []

  return (
    <div className="flex min-h-screen flex-col bg-cream max-w-full overflow-x-hidden">
      <ShopperTopBar
        profile={profile}
        availablePortals={availablePortals}
        portalCookie={portalCookie}
      />
      <main className="flex-1 max-w-full overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <ShopperBottomNav hide={hideBottomNav} />
    </div>
  )
}
