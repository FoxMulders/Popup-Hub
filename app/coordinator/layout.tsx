import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/nav/app-nav'
import { hasAccess } from '@/lib/auth/rbac'
import {
  ACTIVE_PORTAL_COOKIE,
  getAvailablePortals,
  getDefaultDashboard,
} from '@/lib/portals/active-portal'

export default async function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!hasAccess(profile.role, 'coordinator')) {
    redirect(getDefaultDashboard(profile.role, 0))
  }

  const cookieStore = await cookies()
  const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value
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
