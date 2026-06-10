import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authorizeCronRequest } from '@/lib/cron/authorize-cron'
import { releaseEligibleEscrowHolds } from '@/lib/coordinator/escrow'

export async function GET(request: Request) {
  const authError = authorizeCronRequest(request)
  if (authError) return authError

  const supabase = await createServiceClient()
  const result = await releaseEligibleEscrowHolds(supabase)

  return NextResponse.json({ ok: true, ...result })
}
