import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/nav/app-nav'
import { hasAccess } from '@/lib/auth/rbac'
import { getDefaultDashboard } from '@/lib/portals/active-portal'

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
    const { count } = await supabase
      .from('coordinator_vendor_approvals')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_user_id', user.id)
    redirect(getDefaultDashboard(profile.role, count ?? 0))
  }

  return (
    <div className="market-page min-h-screen">
      <AppNav profile={profile} />
      <main>{children}</main>
    </div>
  )
}
