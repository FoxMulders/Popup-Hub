import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SharedLayoutChrome } from '@/components/layout/shared-layout-chrome'
import { ACTIVE_PORTAL_COOKIE, getAvailablePortals } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'

export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  const cookieStore = await cookies()
  const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value
  const availablePortals = getAvailablePortals(profile.role)

  return (
    <SharedLayoutChrome
      profile={profile as Profile}
      availablePortals={availablePortals}
      portalCookie={portalCookie}
    >
      {children}
    </SharedLayoutChrome>
  )
}
