import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'
import { buttonVariants } from '@/components/ui/button'
import { WalletQrPanel } from '@/components/wallet/wallet-qr-panel'
import { buildWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'
import { Banknote, QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  searchParams: Promise<{ u?: string; user?: string }>
}

export default async function WalletDoorPage({ searchParams }: Props) {
  const params = await searchParams
  const userId = parseWalletTopUpQrPayload(params.u ?? params.user ?? '')

  if (!userId) notFound()

  const qrPayload = buildWalletTopUpQrPayload(userId)

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
    <div className="min-h-[100dvh] overflow-x-hidden bg-canvas">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-3 py-6 sm:px-4 sm:py-10">
        <div className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-forest">
            <QrCode className="h-5 w-5 shrink-0" />
            <h1 className="font-heading text-lg font-semibold leading-snug text-foreground sm:text-xl">
              Patron wallet
            </h1>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Staff can scan this code to credit cash at the door or pay out your balance at exit.
          </p>

          <div className="mt-5">
            <WalletQrPanel
              title="Scan at the door"
              qrPayload={qrPayload}
              copyValue={userId}
              ariaLabel="Patron wallet QR for door staff"
            />
          </div>

          {isCoordinator ? (
            <div className="mt-5 space-y-2">
              <Link
                href={`/coordinator/wallet-topup?u=${userId}`}
                className={cn(
                  buttonVariants({
                    className:
                      'w-full min-h-11 gap-2 touch-manipulation bg-forest hover:bg-forest-deep',
                  })
                )}
              >
                <Banknote className="h-4 w-4 shrink-0" />
                Credit wallet (top-up)
              </Link>
              <Link
                href={`/coordinator/wallet-topup?u=${userId}&mode=payout`}
                className={cn(
                  buttonVariants({
                    variant: 'outline',
                    className: 'w-full min-h-11 gap-2 touch-manipulation',
                  })
                )}
              >
                <Banknote className="h-4 w-4 shrink-0" />
                Cash payout (reclaim)
              </Link>
            </div>
          ) : (
            <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
              Coordinators: sign in to credit or pay out this wallet from the top-up desk.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
