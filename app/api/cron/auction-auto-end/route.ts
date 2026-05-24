import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { endExpiredAuctions } from '@/lib/auction/end-auction'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const ended = await endExpiredAuctions(supabase)

  return NextResponse.json({ ended })
}
