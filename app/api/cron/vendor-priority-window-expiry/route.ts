import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { expirePriorityWindows } from '@/lib/engagement/expire-priority-windows'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const result = await expirePriorityWindows(supabase)

  return NextResponse.json({ ok: true, ...result })
}
