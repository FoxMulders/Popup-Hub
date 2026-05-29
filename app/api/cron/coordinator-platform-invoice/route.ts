import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authorizeCronRequest } from '@/lib/cron/authorize-cron'
import { processCoordinatorPlatformInvoices } from '@/lib/cron/coordinator-platform-invoice'

export async function GET(request: Request) {
  const denied = authorizeCronRequest(request)
  if (denied) return denied

  const supabase = await createServiceClient()
  const result = await processCoordinatorPlatformInvoices(supabase)

  return NextResponse.json(result)
}
