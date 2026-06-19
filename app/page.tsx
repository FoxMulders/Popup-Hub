import { createClient } from '@/lib/supabase/server'
import { SiteContentShell } from '@/components/layout/site-content-shell'
import { ShopperShell } from '@/components/shopper/shopper-shell'
import { PublicLanding } from '@/components/public/public-landing'
import type { Profile } from '@/types/database'

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const { GuestNav } = await import('@/components/nav/guest-nav')
    return (
      <div className="flex min-h-0 flex-1 flex-col site-surface">
        <GuestNav />
        <SiteContentShell>
          <PublicLanding />
        </SiteContentShell>
      </div>
    )
  }

  const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = profileRow as Profile | null
  return (
    <ShopperShell profile={profile} hideBottomNav>
      <PublicLanding />
    </ShopperShell>
  )
}
