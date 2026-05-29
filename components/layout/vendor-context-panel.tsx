'use client'

import Link from 'next/link'
import { CreditCard, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function VendorContextPanel() {
  return (
    <aside
      className="flex h-full min-h-0 flex-col gap-3 p-3"
      aria-label="Vendor payments and wallet"
    >
      <div className="ecosystem-panel-inner rounded-xl border border-stone-200/80 bg-card/90 p-3">
        <p className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5 text-violet-500" aria-hidden />
          Payments
        </p>
        <p className="mt-2 text-[0.6875rem] leading-snug text-muted-foreground">
          Approved booths show payment status on your dashboard. Pay via Square
          when a coordinator enables card checkout.
        </p>
        <Link href="/vendor/applications?filter=payment" className="mt-3 block">
          <Button variant="outline" size="sm" className="w-full text-xs">
            View payment due
          </Button>
        </Link>
      </div>

      <div className="ecosystem-panel-inner rounded-xl border border-stone-200/60 bg-canvas/80 p-3">
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-foreground">
          <Wallet className="h-3.5 w-3.5" aria-hidden />
          Wallet
        </p>
        <p className="mt-1 text-[0.6875rem] leading-snug text-muted-foreground">
          Quarter auctions and market wallets live in the patron wallet portal.
        </p>
        <Link
          href="/wallet"
          className="mt-2 inline-flex text-[0.6875rem] font-medium text-sky-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
        >
          Open wallet
        </Link>
      </div>
    </aside>
  )
}
