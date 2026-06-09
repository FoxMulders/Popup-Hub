import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PaymentMethodsForm } from './payment-methods-form'
import { SquareConnectAlerts } from '@/app/coordinator/square-connect/square-connect-alerts'
import {
  getSquareAppId,
  getSquareOAuthRedirectUri,
  isSquareProductionEnvironment,
  tryBuildSquareOAuthAuthorizeUrl,
} from '@/lib/square/connect-url'

export default async function PaymentMethodsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const appId = getSquareAppId()
  const redirectUri = getSquareOAuthRedirectUri()
  let oauthUrl: string | null = null
  let oauthBuildError: string | null = null

  if (appId && redirectUri) {
    const built = tryBuildSquareOAuthAuthorizeUrl({
      clientId: appId,
      redirectUri,
      state: user.id,
    })
    if ('url' in built) {
      oauthUrl = built.url
    } else {
      oauthBuildError = built.error
      console.error('[square/oauth] Payment methods page:', built.error)
    }
  } else if (!appId) {
    console.error(
      '[square/oauth] Square Application ID not configured — set NEXT_PUBLIC_SQUARE_APP_ID, NEXT_PUBLIC_SQUARE_CLIENT_ID, SQUARE_SANDBOX_CLIENT_ID, or SQUARE_CLIENT_ID'
    )
  } else if (!redirectUri) {
    console.error('[square/oauth] NEXT_PUBLIC_APP_URL is not set — OAuth redirect URI cannot be built')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 font-heading text-2xl font-semibold text-foreground">Payment Methods</h1>
      <p className="mb-6 text-muted-foreground">
        Connect Square or Stripe for card payments, enable offline e-Transfer and cash, and manage
        your platform wallet for offline fee collection.
      </p>

      <Suspense fallback={null}>
        <SquareConnectAlerts />
      </Suspense>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <PaymentMethodsForm
          userId={user.id}
          squareOauthUrl={oauthUrl}
          squareOauthBuildError={oauthBuildError}
          squareEnvironmentLabel={isSquareProductionEnvironment() ? 'Production' : 'Sandbox'}
          squareRedirectUri={redirectUri}
          showDevSandboxBypass={
            process.env.NODE_ENV === 'development' && !isSquareProductionEnvironment()
          }
        />
      </Suspense>
    </div>
  )
}
