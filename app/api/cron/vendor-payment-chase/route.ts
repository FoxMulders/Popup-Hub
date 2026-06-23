import { NextResponse } from 'next/server'
import { chaseUnpaidPayments } from '@/lib/applications/chase-unpaid-payments'
import { authorizeCronRequest } from '@/lib/cron/authorize-cron'
import { createServiceClient } from '@/lib/supabase/server'

/** Daily cron: remind vendors to pay (in-app + email + SMS) and auto-release overdue booths. */
export async function GET(request: Request) {
  const denied = authorizeCronRequest(request)
  if (denied) return denied

  const supabase = await createServiceClient()
  const result = await chaseUnpaidPayments(supabase)

  return NextResponse.json({ ok: true, ...result })
}
