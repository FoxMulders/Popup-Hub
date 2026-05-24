import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { endExpiredAuctions } from '@/lib/auction/end-auction'
import { authorizeCronRequest } from '@/lib/cron/authorize-cron'

export async function GET(request: Request) {
  const denied = authorizeCronRequest(request)
  if (denied) return denied

  const supabase = await createServiceClient()
  const ended = await endExpiredAuctions(supabase)

  return NextResponse.json({ ended })
}
