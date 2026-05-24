import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { ConnectSquareButton } from './connect-button'

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

  const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/square/oauth/callback`
  const scope = 'MERCHANT_PROFILE_READ PAYMENTS_WRITE ORDERS_WRITE'
  const oauthUrl = `https://connect.squareup.com/oauth2/authorize?client_id=${appId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${user.id}`

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-2 font-heading text-2xl font-semibold text-foreground">Connect Square Account</h1>
      <p className="mb-6 text-muted-foreground">Link your Square seller account to collect booth payments.</p>

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
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">Square account connected</p>
                <p className="text-xs text-green-600">You can now collect booth payments.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-harvest-50 border border-harvest-200 p-3">
                <p className="text-sm text-harvest-800">No Square account connected yet.</p>
              </div>
              <ConnectSquareButton oauthUrl={oauthUrl} />
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
