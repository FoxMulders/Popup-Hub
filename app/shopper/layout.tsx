import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { GuestNav } from '@/components/nav/guest-nav'
import { ShopperLayoutChrome } from '@/components/layout/shopper-layout-chrome'
import {
  ACTIVE_PORTAL_COOKIE,
  getAvailablePortals,
} from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'

export default async function ShopperLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data as Profile
  }

  const cookieStore = await cookies()
  const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value
  const availablePortals = profile
    ? getAvailablePortals(profile.role, { isAdmin: profile.is_admin })
    : []

  if (profile) {
    return (
      <ShopperLayoutChrome
        profile={profile}
        availablePortals={availablePortals}
        portalCookie={portalCookie}
      >
        {children}
      </ShopperLayoutChrome>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <GuestNav />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
