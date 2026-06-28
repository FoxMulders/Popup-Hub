import { NextResponse } from 'next/server'
import { searchAdminUsers } from '@/lib/admin/user-search'
import { hasAdminAccess } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  if (!(await hasAdminAccess(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''

  if (q.trim().length < 2) {
    return NextResponse.json({ users: [] })
  }

  const admin = createAdminClient()
  const users = await searchAdminUsers(admin, q)

  return NextResponse.json({ users })
}
