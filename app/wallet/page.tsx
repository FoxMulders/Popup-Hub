import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WalletView } from '@/components/wallet/wallet-view'
import { BoothCheckout } from '@/components/wallet/booth-checkout'
import type { Wallet, WalletTransaction } from '@/types/database'

export default async function WalletPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Digital Wallet</h1>
      <WalletView
        wallet={walletRow as Wallet | null}
        transactions={(transactions as WalletTransaction[]) ?? []}
        userId={user.id}
      />
      <div className="mt-6">
        <BoothCheckout balance={walletRow?.balance ?? 0} userId={user.id} />
      </div>
    </div>
  )
}
