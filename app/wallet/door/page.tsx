import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'
import { buttonVariants } from '@/components/ui/button'
import { WalletDoorCopyButton } from '@/components/wallet/wallet-door-copy-button'
import { Banknote, QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  searchParams: Promise<{ u?: string; user?: string }>
}

export default async function WalletDoorPage({ searchParams }: Props) {
  const params = await searchParams
  const userId = parseWalletTopUpQrPayload(params.u ?? params.user ?? '')

  if (!userId) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isCoordinator = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isCoordinator = profile?.role === 'coordinator'
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-forest">
            <QrCode className="h-5 w-5" />
            <h1 className="font-heading text-xl font-semibold text-foreground">Patron wallet</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Staff can scan this code to credit cash at the door. The wallet ID is below if you need to
            paste it manually.
          </p>
          <div className="mt-5 rounded-xl border bg-canvas p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Wallet ID
            </p>
            <p className="mt-2 break-all font-mono text-xs text-foreground">{userId}</p>
            <WalletDoorCopyButton value={userId} className="mt-3" />
          </div>
          {isCoordinator ? (
            <Link
              href={`/coordinator/wallet-topup?u=${userId}`}
              className={cn(
                buttonVariants({
                  className: 'mt-5 w-full min-h-11 gap-2 bg-forest hover:bg-forest-deep',
                })
              )}
            >
              <Banknote className="h-4 w-4" />
              Open top-up desk
            </Link>
          ) : (
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Coordinators: sign in to credit this wallet from the top-up desk.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
