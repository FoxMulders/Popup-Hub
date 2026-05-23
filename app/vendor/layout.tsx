import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VendorShell } from '@/components/vendor/vendor-shell'
import { countCoordinatorApprovals } from '@/lib/vendor/access'
import type { Profile } from '@/types/database'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/vendor/dashboard')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  if (profile.role === 'coordinator') redirect('/coordinator/dashboard')

  // Shoppers may only reach /vendor/activate (middleware blocks all other /vendor/* paths).
  if (profile.role === 'shopper') {
    return <div className="min-h-screen bg-cream">{children}</div>
  }

  const approvalCount = await countCoordinatorApprovals(supabase, user.id)
  if (approvalCount === 0) {
    redirect('/discover?vendor=locked')
  }

  return (
    <VendorShell profile={profile as Profile} approvalCount={approvalCount}>
      {children}
    </VendorShell>
  )
}
