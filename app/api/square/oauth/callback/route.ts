import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { squareClient } from '@/lib/square/client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // coordinator user id
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/coordinator/square-connect?error=${error ?? 'missing_code'}`
    )
  }

  try {
    const response = await squareClient.oAuth.obtainToken({
      clientId: process.env.NEXT_PUBLIC_SQUARE_APP_ID!,
      clientSecret: process.env.SQUARE_ACCESS_TOKEN!,
      code,
      grantType: 'authorization_code',
    })

    const merchantId = response.merchantId

    if (!merchantId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/coordinator/square-connect?error=no_merchant`
      )
    }

    // Store merchant ID on all events for this coordinator
    const supabase = await createClient()
    await supabase
      .from('events')
      .update({ square_merchant_id: merchantId })
      .eq('coordinator_id', state)
      .is('square_merchant_id', null)

    // Also store on profile for future events (we use metadata)
    await supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() } as never)
      .eq('id', state)

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/coordinator/square-connect?success=true`
    )
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/coordinator/square-connect?error=oauth_failed`
    )
  }
}
