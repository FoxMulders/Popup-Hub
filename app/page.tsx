import { createClient } from '@/lib/supabase/server'
import { SiteContentShell } from '@/components/layout/site-content-shell'
import { ShopperShell } from '@/components/shopper/shopper-shell'
import { PublicLanding } from '@/components/public/public-landing'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_TITLE } from '@/lib/seo/site-config'
import type { Profile } from '@/types/database'

export const metadata = buildPublicMetadata({
  title: DEFAULT_SITE_TITLE,
  description: DEFAULT_SITE_DESCRIPTION,
  path: '/',
})

export const revalidate = 60

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
