import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/nav/app-nav'
import { GuestNav } from '@/components/nav/guest-nav'
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
  const availablePortals = profile ? getAvailablePortals(profile.role) : []

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      {profile ? (
        <AppNav
          profile={profile}
          availablePortals={availablePortals}
          portalCookie={portalCookie}
        />
      ) : (
        <GuestNav />
      )}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
