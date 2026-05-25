import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMyNightSummary } from '@/lib/market-night/summary'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()
  const summary = await getMyNightSummary(service, eventId, user.id)

  if (!summary) {
    return NextResponse.json(
      { error: 'Recap is available after the market concludes.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ summary })
}
