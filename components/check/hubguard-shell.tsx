import { cookies } from 'next/headers'
import { HubGuardLogo } from '@/components/brand/hubguard-logo'
import { GuestNav } from '@/components/nav/guest-nav'
import { AppNav } from '@/components/nav/app-nav'
import { FeatureRequestProvider } from '@/components/feedback/feature-request-context'
import { SiteContentShell } from '@/components/layout/site-content-shell'
import { createClient } from '@/lib/supabase/server'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'
import {
  ACTIVE_PORTAL_COOKIE,
  getAvailablePortals,
} from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'

interface HubGuardShellProps {
  children: React.ReactNode
}

/** Public HubGuard chrome — site nav, branded header, no shopper bottom nav. */
export async function HubGuardShell({ children }: HubGuardShellProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data as Profile | null
  }

  const cookieStore = await cookies()
  const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value
  const availablePortals = profile
    ? getAvailablePortals(profile.role, { isAdmin: profile.is_admin })
    : []

  const nav = profile ? (
    <FeatureRequestProvider profile={profile} portalCookie={portalCookie}>
      <AppNav
        profile={profile}
        availablePortals={availablePortals}
        portalCookie={portalCookie}
      />
    </FeatureRequestProvider>
  ) : (
    <GuestNav />
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col site-surface">
      {nav}
      <SiteContentShell showBackBar={availablePortals.length <= 1}>
        <header className="border-b border-stone-200/70 bg-cream/60 px-4 py-3 sm:py-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2">
            <HubGuardLogo variant="lockup" size="md" href="/check" priority />
            <p className="text-sm font-semibold uppercase tracking-wide text-harvest-700">
              {TRUST_DIRECTORY_LINKS.check.tagline}
            </p>
          </div>
        </header>
        <main id="site-main" className="w-full max-w-full overflow-x-hidden">
          {children}
        </main>
      </SiteContentShell>
    </div>
  )
}
