import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePublicMarketsCache } from '@/lib/cache/public-markets'

/** Coordinator-only: bust cached discover / vendor directory reads after publish or status change. */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  revalidatePublicMarketsCache()

  return NextResponse.json({ ok: true, revalidated: true })
}
