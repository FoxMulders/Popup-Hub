import { NextResponse } from 'next/server'
import { enforceNativeMarketPermissions } from '@/lib/markets/enforce-native-market-permissions'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: marketId } = await params
  const supabase = await createClient()
  const gate = await enforceNativeMarketPermissions(supabase, marketId)
  if (gate) return gate

  return NextResponse.json(
    {
      error: 'Use coordinator application routes for mutations',
      marketId,
    },
    { status: 501 }
  )
}
