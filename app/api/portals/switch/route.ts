import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
  ACTIVE_PORTAL_COOKIE,
  canAccessPortal,
  getPortalHome,
  type ActivePortal,
} from '@/lib/portals/active-portal'
import type { Role } from '@/types/database'

const VALID_PORTALS: ActivePortal[] = ['patron', 'vendor', 'coordinator']

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { portal?: ActivePortal }
  const portal = body.portal
  if (!portal || !VALID_PORTALS.includes(portal)) {
    return NextResponse.json({ error: 'Invalid portal' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  const role = (profile?.role as Role | undefined) ?? 'shopper'
  if (!canAccessPortal(role, portal, { isAdmin: profile?.is_admin === true })) {
    return NextResponse.json({ error: 'Portal not available for this account' }, { status: 403 })
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_PORTAL_COOKIE, portal, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  const redirectTo = getPortalHome(portal)
  return NextResponse.json({ ok: true, portal, redirectTo })
}
