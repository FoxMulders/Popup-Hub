import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ShopperShell } from '@/components/shopper/shopper-shell'
import { VendorShell } from '@/components/vendor/vendor-shell'
import { resolveActivePortal } from '@/lib/portals/active-portal'
import { countCoordinatorApprovals } from '@/lib/vendor/access'
import type { Profile } from '@/types/database'

interface PortalAwareShellProps {
  children: React.ReactNode
}

export async function PortalAwareShell({ children }: PortalAwareShellProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: Profile | null = null
  let approvalCount = 0

  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data as Profile | null
    approvalCount = await countCoordinatorApprovals(supabase, user.id)
  }

  const cookieStore = await cookies()
  const portal = resolveActivePortal(
    cookieStore.get('active_portal')?.value,
    profile,
    approvalCount
  )

  if (portal === 'vendor' && profile && approvalCount > 0) {
    return (
      <VendorShell profile={profile} approvalCount={approvalCount}>
        {children}
      </VendorShell>
    )
  }

  return <ShopperShell>{children}</ShopperShell>
}
