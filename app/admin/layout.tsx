import { redirect } from 'next/navigation'
import { hasAdminAccess } from '@/lib/auth/require-admin'
import { accessDeniedRedirect } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { AdminShellChrome } from '@/components/admin/admin-shell-chrome'

import type { Metadata } from 'next'
import { buildPrivatePortalMetadata } from '@/lib/seo/public-metadata'

export const metadata: Metadata = buildPrivatePortalMetadata('Popup Hub — Admin')

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const allowed = await hasAdminAccess()
  if (!allowed) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase.from('profiles').select('role').eq('id', user.id).single()
      : { data: null }
    redirect(accessDeniedRedirect(profile?.role))
  }

  return <AdminShellChrome>{children}</AdminShellChrome>
}
