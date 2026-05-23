import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_PORTAL_COOKIE, type ActivePortal } from '@/lib/portals/active-portal'
import { countCoordinatorApprovals } from '@/lib/vendor/access'
import { canAccessVendorPortal } from '@/lib/auth/rbac'
import type { Role } from '@/types/database'

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
  if (portal !== 'markets' && portal !== 'vendor') {
    return NextResponse.json({ error: 'Invalid portal' }, { status: 400 })
  }

  if (portal === 'vendor') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile?.role as Role | undefined) ?? 'shopper'
    const approvalCount = await countCoordinatorApprovals(supabase, user.id)
    if (!canAccessVendorPortal(role, approvalCount)) {
      return NextResponse.json({ error: 'Vendor portal not unlocked' }, { status: 403 })
    }
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_PORTAL_COOKIE, portal, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  return NextResponse.json({ ok: true, portal })
}
