import Link from 'next/link'
import { CreditCard, Wallet } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CoordinatorPaymentReadinessCalloutProps {
  organizationName: string | null
  squareConnected: boolean
  stripeConnected: boolean
  className?: string
}

export function CoordinatorPaymentReadinessCallout({
  organizationName,
  squareConnected,
  stripeConnected,
  className,
}: CoordinatorPaymentReadinessCalloutProps) {
  if (squareConnected || stripeConnected) return null

  const hasOrgName = Boolean(organizationName?.trim())

  return (
    <section
      className={cn(
        'rounded-xl border border-harvest-200/80 bg-harvest-50/50 px-4 py-4 text-sm',
        className
      )}
      aria-labelledby="coordinator-payment-readiness"
    >
      <p
        id="coordinator-payment-readiness"
        className="inline-flex items-center gap-2 font-semibold text-foreground"
      >
        <CreditCard className="h-4 w-4 text-harvest-700" aria-hidden />
        Before you publish
      </p>
      <p className="mt-1 text-muted-foreground leading-relaxed">
        {hasOrgName ? (
          <>
            Your organization name is saved — you can publish for discovery. Connect Square or Stripe
            when you are ready for vendors to pay booth fees by card.
          </>
        ) : (
          <>
            Add your organization name to publish with offline booth fees, or connect Square / Stripe
            for card checkout. You can finish market setup first — payouts are the last step.
          </>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/coordinator/payment-methods" className={buttonVariants({ size: 'sm' })}>
          Payment methods
        </Link>
        {!hasOrgName ? (
          <Link
            href="/coordinator/payment-methods#organization"
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
          >
            Add organization name
          </Link>
        ) : (
          <Link
            href="/coordinator/wallet-topup"
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'gap-1.5')}
          >
            <Wallet className="h-3.5 w-3.5" aria-hidden />
            Platform wallet
          </Link>
        )}
      </div>
    </section>
  )
}
