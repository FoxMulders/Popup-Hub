import { NextResponse } from 'next/server'
import { fetchAdminUserDetail } from '@/lib/admin/user-detail'
import { resolveAdminDb } from '@/lib/auth/require-admin'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const adminCtx = await resolveAdminDb(request)
  if (!adminCtx.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const user = await fetchAdminUserDetail(adminCtx.db, id)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ user })
}
