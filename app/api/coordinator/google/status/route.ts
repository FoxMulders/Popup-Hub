import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  getGoogleOAuthClientId,
  getGoogleOAuthClientSecret,
} from '@/lib/google/oauth'

/** Lightweight check before navigating to OAuth start (avoids raw JSON trap). */
export async function GET() {
  const configured = Boolean(getGoogleOAuthClientId() && getGoogleOAuthClientSecret())

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ configured, authorized: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ configured, authorized: false, error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ configured, authorized: true })
}
