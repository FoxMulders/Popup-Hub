import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getDefaultDashboard } from '@/lib/portals/active-portal'
import { countCoordinatorApprovals } from '@/lib/vendor/access'
import type { Role } from '@/types/database'

const VALID_SIGNUP_ROLES: Role[] = ['shopper', 'vendor', 'coordinator']

/** Supabase SSR auth cookie prefix — clear stale session before magic-link exchange. */
function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith('sb-') || name.includes('supabase-auth')
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const roleParam = searchParams.get('role')

  if (code) {
    const cookieStore = await cookies()

    for (const { name } of cookieStore.getAll()) {
      if (isSupabaseAuthCookie(name)) {
        cookieStore.delete(name)
      }
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        if (roleParam && VALID_SIGNUP_ROLES.includes(roleParam as Role)) {
          await supabase
            .from('profiles')
            .update({ role: roleParam as Role })
            .eq('id', user.id)
        }

        const shareCookie = cookieStore.get('signup_share_contact')?.value
        if (shareCookie === '1' || shareCookie === '0') {
          await supabase
            .from('profiles')
            .update({ share_contact_with_vendors: shareCookie === '1' })
            .eq('id', user.id)
          cookieStore.delete('signup_share_contact')
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile) {
          const approvalCount = await countCoordinatorApprovals(supabase, user.id)
          const dashboard = getDefaultDashboard(profile.role, approvalCount)
          return NextResponse.redirect(`${origin}${dashboard}`)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
