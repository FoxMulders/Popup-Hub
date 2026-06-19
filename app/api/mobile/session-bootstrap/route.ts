import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
  ACTIVE_PORTAL_COOKIE,
  parseActivePortal,
  type ActivePortal,
} from '@/lib/portals/active-portal'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ authenticated: false })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  const cookieStore = await cookies()
  const activePortal = parseActivePortal(cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value)

  return NextResponse.json({
    authenticated: true,
    role: profile?.role ?? 'shopper',
    isAdmin: profile?.is_admin === true,
    activePortal: activePortal as ActivePortal | null,
  })
}
