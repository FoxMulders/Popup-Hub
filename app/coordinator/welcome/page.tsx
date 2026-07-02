import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { PortalConversionGate } from '@/components/coordinator/conversion/portal-conversion-gate'
import { COORDINATOR_HOME_PATH } from '@/lib/coordinator/coordinator-routes'
import { COORDINATOR_WELCOME_DISMISSED_COOKIE } from '@/lib/coordinator/conversion-listing'
import {
  COORDINATOR_FRAUD_PROFILE_SELECT,
  isSquareConnectedCoordinator,
} from '@/lib/coordinator/verification'

export default async function CoordinatorWelcomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const dismissed = cookieStore.get(COORDINATOR_WELCOME_DISMISSED_COOKIE)?.value === '1'

  const scope = await getCoordinatorScope(supabase, user.id)

  const [profileResult, eventsResult, coordProfileResult] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    scope.isAdmin
      ? supabase
          .from('events')
          .select('id, name, is_external_listing, ad_campaign_status')
          .order('start_at', { ascending: false })
          .limit(20)
      : supabase
          .from('events')
          .select('id, name, is_external_listing, ad_campaign_status')
          .eq('coordinator_id', user.id)
          .order('start_at', { ascending: false })
          .limit(20),
    supabase
      .from('profiles')
      .select(COORDINATOR_FRAUD_PROFILE_SELECT)
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const markets = (eventsResult.data ?? []).map((event) => ({
    id: event.id,
    name: event.name,
    isExternalListing: event.is_external_listing === true,
    adCampaignStatus: event.ad_campaign_status ?? null,
  }))

  const hasExternalListing = markets.some((m) => m.isExternalListing)
  const hasNativeMarket = markets.some((m) => !m.isExternalListing)

  if (dismissed && !hasExternalListing && (hasNativeMarket || markets.length === 0)) {
    redirect(COORDINATOR_HOME_PATH)
  }

  return (
    <PortalConversionGate
      displayName={profileResult.data?.full_name ?? null}
      markets={markets}
      squareConnected={isSquareConnectedCoordinator(coordProfileResult.data)}
      continueHref={markets.length > 0 ? '/coordinator/markets' : COORDINATOR_HOME_PATH}
    />
  )
}
