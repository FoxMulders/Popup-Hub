import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAdminPendingQueueCounts } from '@/lib/admin/pending-queue-counts'
import { hasAdminAccess } from '@/lib/auth/require-admin'

export async function GET() {
  const allowed = await hasAdminAccess()
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = await createServiceClient()
  const counts = await fetchAdminPendingQueueCounts(service)
  return NextResponse.json(counts)
}
