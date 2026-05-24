import { createClient } from '@/lib/supabase/server'
import { ShopperTopBar } from '@/components/shopper/shopper-top-bar'
import { ShopperBottomNav } from '@/components/shopper/shopper-bottom-nav'
import { countCoordinatorApprovals } from '@/lib/vendor/access'
import { canAccessVendorPortal } from '@/lib/auth/rbac'
import type { Profile } from '@/types/database'

interface ShopperShellProps {
  children: React.ReactNode
  hideBottomNav?: boolean
}

export async function ShopperShell({ children, hideBottomNav }: ShopperShellProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: Profile | null = null
  let hasVendorPortal = false
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data as Profile | null
    const approvalCount = await countCoordinatorApprovals(supabase, user.id)
    hasVendorPortal = canAccessVendorPortal(profile?.role ?? 'shopper', approvalCount)
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream max-w-full overflow-x-hidden">
      <ShopperTopBar profile={profile} vendorAccessCount={hasVendorPortal ? 1 : 0} />
      <main className="flex-1 max-w-full overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <ShopperBottomNav hide={hideBottomNav} />
    </div>
  )
}
