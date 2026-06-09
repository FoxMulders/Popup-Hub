import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ShopperShellClient } from '@/components/shopper/shopper-shell-client'
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
    <ShopperShellClient
      hideBottomNav={hideBottomNav}
      profile={profile}
      availablePortals={availablePortals}
      portalCookie={portalCookie}
    >
      {children}
    </ShopperShellClient>
  )
}
