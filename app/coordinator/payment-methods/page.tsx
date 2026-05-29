import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PaymentMethodsForm } from './payment-methods-form'
import {
  buildSquareOAuthAuthorizeUrl,
  getSquareAppId,
  getSquareOAuthRedirectUri,
  isSquareProductionEnvironment,
} from '@/lib/square/connect-url'

export default async function PaymentMethodsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const appId = getSquareAppId()
  const redirectUri = getSquareOAuthRedirectUri()
  const oauthUrl =
    appId && redirectUri
      ? buildSquareOAuthAuthorizeUrl({
          clientId: appId,
          redirectUri,
          state: user.id,
        })
      : null

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 font-heading text-2xl font-semibold text-foreground">Payment Methods</h1>
      <p className="mb-6 text-muted-foreground">
        Connect Square or Stripe for card payments, enable offline e-Transfer and cash, and manage
        your platform wallet for offline fee collection.
      </p>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <PaymentMethodsForm
          userId={user.id}
          squareOauthUrl={oauthUrl}
          squareEnvironmentLabel={isSquareProductionEnvironment() ? 'Production' : 'Sandbox'}
          squareRedirectUri={redirectUri}
          squareAppId={appId}
          showDevSandboxBypass={
            process.env.NODE_ENV === 'development' && !isSquareProductionEnvironment()
          }
        />
      </Suspense>
    </div>
  )
}
