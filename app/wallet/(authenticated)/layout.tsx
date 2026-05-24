import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalAwareShell } from '@/components/layout/portal-aware-shell'

export default async function WalletAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <PortalAwareShell>{children}</PortalAwareShell>
}
