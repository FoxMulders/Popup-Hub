import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WalletView } from '@/components/wallet/wallet-view'
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

  return (
    <div className="wallet-page mx-auto min-w-0 w-full max-w-2xl overflow-x-hidden px-3 pt-4 pb-6 sm:px-4 sm:py-8 sm:pb-8">
      <h1 className="mb-4 font-heading text-xl font-bold tracking-tight text-foreground sm:mb-6 sm:text-2xl">
        Digital Wallet
      </h1>
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <WalletView
          wallet={walletRow as Wallet | null}
          transactions={(transactions as WalletTransaction[]) ?? []}
          userId={user.id}
          userEmail={user.email ?? ''}
        />
        <BoothCheckout balance={walletRow?.balance ?? 0} userId={user.id} />
      </div>
    </div>
  )
}
