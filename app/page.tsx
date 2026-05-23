import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDefaultDashboard } from '@/lib/portals/active-portal'
import { countCoordinatorApprovals } from '@/lib/vendor/access'

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const { GuestNav } = await import('@/components/nav/guest-nav')
    const { PublicLanding } = await import('@/components/public/public-landing')
    return (
      <div className="flex min-h-screen flex-col bg-cream">
        <GuestNav />
        <PublicLanding />
      </div>
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const approvalCount = await countCoordinatorApprovals(supabase, user.id)
  redirect(getDefaultDashboard(profile?.role ?? 'shopper', approvalCount))
}
