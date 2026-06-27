import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WalletView } from '@/components/wallet/wallet-view'
import { PopupFundsWordmark } from '@/components/brand/popup-funds-logo'
import { BoothCheckout } from '@/components/wallet/booth-checkout'
import { ensureWallet } from '@/lib/wallet/credit-deposit'
import type { Wallet, WalletTransaction } from '@/types/database'

export default async function WalletPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = await createServiceClient()
  await ensureWallet(service, user.id)

  const { data: walletRow } = await supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle()

  const walletIds =
    walletRow != null
      ? [walletRow.id]
      : ((await supabase.from('wallets').select('id').eq('user_id', user.id)).data?.map((w) => w.id) ?? [])

  const { data: transactions } =
    walletIds.length > 0
      ? await supabase
          .from('wallet_transactions')
          .select('*')
          .in('wallet_id', walletIds)
          .order('created_at', { ascending: false })
          .limit(30)
      : { data: [] }

  const { data: eventPaddles } = await supabase
    .from('event_paddles')
    .select('paddle_number')
    .eq('user_id', user.id)
    .order('purchased_at', { ascending: false })

  const paddleNumbers = (eventPaddles ?? []).map((p) => p.paddle_number as string)

  return (
    <div className="wallet-page mx-auto min-w-0 w-full max-w-2xl overflow-x-hidden px-3 pt-4 pb-6 sm:px-4 sm:py-8 sm:pb-8">
      <div className="mb-4 flex flex-col gap-2 sm:mb-6">
        <PopupFundsWordmark priority />
        <p className="text-sm text-muted-foreground">
          Top up, bid, and reclaim market-day balance in one place.
        </p>
      </div>
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <WalletView
          wallet={walletRow as Wallet | null}
          transactions={(transactions as WalletTransaction[]) ?? []}
          paddleNumbers={paddleNumbers}
          userId={user.id}
          userEmail={user.email ?? ''}
        />
        <BoothCheckout balance={walletRow?.balance ?? 0} userId={user.id} />
      </div>
    </div>
  )
}
