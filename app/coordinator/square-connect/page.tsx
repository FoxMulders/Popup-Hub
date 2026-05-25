import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SquareConnectAlerts } from './square-connect-alerts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { ConnectSquareButton } from './connect-button'
import { SandboxSquareOAuthNotice } from './sandbox-oauth-notice'
import {
  buildSquareOAuthAuthorizeUrl,
  getSquareAppId,
  getSquareOAuthRedirectUri,
  isSquareProductionEnvironment,
} from '@/lib/square/connect-url'

export default async function SquareConnectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: connectedEvent } = await supabase
    .from('events')
    .select('square_merchant_id')
    .eq('coordinator_id', user.id)
    .not('square_merchant_id', 'is', null)
    .limit(1)
    .maybeSingle()

  const isConnected = !!connectedEvent?.square_merchant_id

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
  const squareEnvironmentLabel = isSquareProductionEnvironment() ? 'Production' : 'Sandbox'

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-2 font-heading text-2xl font-semibold text-foreground">Connect Square Account</h1>
      <p className="mb-6 text-muted-foreground">Link your Square seller account to collect booth payments.</p>

      <Suspense fallback={null}>
        <SquareConnectAlerts />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-5 w-5 text-sage-600" />
            Square Payments
          </CardTitle>
          <CardDescription>
            Vendors pay booth fees through Square after you approve their application.
            Popup Hub retains a platform fee of 3% + $1.00 per paid booth; you receive the rest directly in your Square account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <div className="flex items-center gap-2 rounded-lg bg-sage-50 p-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-sage-700">Square account connected</p>
                <p className="text-xs text-green-600">You can now collect booth payments.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-harvest-50 border border-harvest-200 p-3 space-y-1">
                <p className="text-sm text-harvest-800">No Square account connected yet.</p>
                <p className="text-xs text-harvest-700/90">
                  Square environment: <span className="font-medium">{squareEnvironmentLabel}</span>
                  {!isSquareProductionEnvironment()
                    ? ' — OAuth uses connect.squareupsandbox.com. Use your Sandbox Application ID from the Square Developer Dashboard.'
                    : ' — OAuth uses connect.squareup.com.'}
                </p>
              </div>
              {!isSquareProductionEnvironment() ? <SandboxSquareOAuthNotice /> : null}
              {redirectUri ? (
                <p className="text-xs text-muted-foreground">
                  Register this redirect URL in Square (Sandbox → OAuth):{' '}
                  <code className="block mt-1 break-all rounded bg-muted px-2 py-1 text-[11px]">
                    {redirectUri}
                  </code>
                </p>
              ) : null}
              {!appId ? (
                <div className="rounded-lg border border-terracotta-200 bg-terracotta-50 p-3 text-sm text-terracotta-900">
                  Missing <code className="text-xs">NEXT_PUBLIC_SQUARE_APP_ID</code>. Add your Square
                  Application ID to <code className="text-xs">.env.local</code> (or Vercel env) and redeploy.
                </div>
              ) : !redirectUri ? (
                <div className="rounded-lg border border-terracotta-200 bg-terracotta-50 p-3 text-sm text-terracotta-900">
                  Missing <code className="text-xs">NEXT_PUBLIC_APP_URL</code>. Set it to your site origin
                  (e.g. <code className="text-xs">https://popup-hub.vercel.app</code>) so Square OAuth redirect
                  matches your deployment.
                </div>
              ) : (
                <ConnectSquareButton oauthUrl={oauthUrl!} />
              )}
            </>
          )}

          <div className="space-y-2 text-xs text-muted-foreground">
            {['Direct deposits to your Square bank account', 'Platform fee of 3% + $1.00 retained automatically on each paid booth', 'Full transaction history in your Square dashboard'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-sage-600 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4">
        <Link href="/coordinator/dashboard">
          <Button variant="ghost" size="sm">← Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
