import { NextResponse } from 'next/server'
import { applyAdminUserAction, parseAdminUserAction } from '@/lib/admin/user-admin-actions'
import { resolveAdminDb } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const adminCtx = await resolveAdminDb(request)
  if (!adminCtx.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json().catch(() => null)
  const payload = parseAdminUserAction(body)

  if (!payload) {
    return NextResponse.json({ error: 'Invalid action payload' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user: actingUser },
  } = await supabase.auth.getUser()

  const result = await applyAdminUserAction(
    adminCtx.db,
    id,
    actingUser?.id ?? null,
    payload
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true, message: result.message })
}
