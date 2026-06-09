import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { isDevMockAuthEnabled } from '@/lib/auth/dev-mock-session'
import { isSquareProductionEnvironment } from '@/lib/square/connect-url'
import {
  connectCoordinatorSandboxFromEnv,
  SquareSandboxConnectError,
} from '@/lib/square/connect-coordinator-sandbox-token'

function redirectWithResult(code: 'success' | string, detail?: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url = new URL(`${base}/coordinator/square-connect`)
  if (code === 'success') {
    url.searchParams.set('success', 'true')
  } else {
    url.searchParams.set('error', code)
    if (detail) url.searchParams.set('detail', detail.slice(0, 240))
  }
  return NextResponse.redirect(url.toString())
}

export async function GET() {
  if (!isDevMockAuthEnabled() || isSquareProductionEnvironment()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return redirectWithResult('session_mismatch')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) return redirectWithResult('forbidden')

  try {
    await connectCoordinatorSandboxFromEnv(supabase, user.id)
    return redirectWithResult('success')
  } catch (err) {
    if (err instanceof SquareSandboxConnectError) {
      return redirectWithResult(err.code, err.message)
    }
    const message = err instanceof Error ? err.message : 'connect_failed'
    return redirectWithResult('dev_token_failed', message)
  }
}
