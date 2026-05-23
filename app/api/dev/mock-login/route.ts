import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  devMockRoleConfig,
  isDevMockAuthEnabled,
  parseDevMockRole,
} from '@/lib/auth/dev-mock-session'

export async function GET(request: Request) {
  if (!isDevMockAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { searchParams, origin } = new URL(request.url)
  const role = parseDevMockRole(searchParams.get('role'))

  if (!role) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', 'invalid_mock_role')
    return NextResponse.redirect(url)
  }

  const config = devMockRoleConfig(role)
  const supabase = await createClient()

  // Local scope only — global signOut revokes the same user's sessions in other browser profiles.
  await supabase.auth.signOut({ scope: 'local' })

  if (config.anonymous) {
    return NextResponse.redirect(new URL(config.redirectTo, origin))
  }

  if (!config.email || !config.password) {
    const url = new URL('/login', origin)
    url.searchParams.set(
      'error',
      `dev_mock_missing_credentials_${role}`
    )
    return NextResponse.redirect(url)
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: config.email,
    password: config.password,
  })

  if (error) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', 'dev_mock_sign_in_failed')
    url.searchParams.set('detail', error.message)
    return NextResponse.redirect(url)
  }

  return NextResponse.redirect(new URL(config.redirectTo, origin))
}
