import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VendorShell } from '@/components/vendor/vendor-shell'
import { countCoordinatorApprovals } from '@/lib/vendor/access'
import { hasAccess } from '@/lib/auth/rbac'

import type { Profile } from '@/types/database'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/vendor/dashboard')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  if (!hasAccess(profile.role, 'vendor')) {
    return <div className="min-h-screen bg-cream">{children}</div>
  }

  const approvalCount = await countCoordinatorApprovals(supabase, user.id)

  return (
    <VendorShell profile={profile as Profile} approvalCount={approvalCount}>
      {children}
    </VendorShell>
  )
}
