import { redirect } from 'next/navigation'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { DoorWalletTopUp } from '@/components/coordinator/door-wallet-topup'
import { parseWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'

interface Props {
  searchParams: Promise<{ u?: string; user?: string; mode?: string }>
}

export default async function CoordinatorWalletTopUpPage({ searchParams }: Props) {
  const query = await searchParams
  const initialUserId = parseWalletTopUpQrPayload(query.u ?? query.user ?? '')
  const initialMode = query.mode === 'payout' ? 'payout' : 'topup'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    redirect('/discover')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Wallet top-up desk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credit patron wallets from cash at the door, confirm Interac top-ups, and process end-of-event
          balance reclaims. Patrons without a phone can be looked up by name or wallet number at the desk.
        </p>
      </div>
      <DoorWalletTopUp initialUserId={initialUserId} initialMode={initialMode} />
    </div>
  )
}
