import Link from 'next/link'
import { FileWarning, ShieldCheck, Timer } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  formatPaymentDueAtDisplay,
  paymentDueCountdownLabel,
} from '@/lib/applications/payment-deadline'

interface VendorActionRequiredBannerProps {
  pendingInsuranceCount: number
  paymentDueCount: number
  /** Nearest payment deadline among unpaid applications (ISO). */
  nearestPaymentDueAt?: string | null
  urgentPaymentCount?: number
  className?: string
}

export function VendorActionRequiredBanner({
  pendingInsuranceCount,
  paymentDueCount,
  nearestPaymentDueAt,
  urgentPaymentCount = 0,
  className,
}: VendorActionRequiredBannerProps) {
  if (pendingInsuranceCount === 0 && paymentDueCount === 0) return null

  const paymentUrgent =
    urgentPaymentCount > 0 ||
    (nearestPaymentDueAt != null &&
      new Date(nearestPaymentDueAt).getTime() - Date.now() <= 24 * 60 * 60 * 1000)

  return (
    <section
      className={cn(
        'space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-4 text-sm',
        className
      )}
      aria-labelledby="vendor-action-required"
    >
      <p
        id="vendor-action-required"
        className="inline-flex items-center gap-2 font-semibold text-foreground"
      >
        <FileWarning className="h-4 w-4 text-amber-800" aria-hidden />
        Action required on your applications
      </p>

      {pendingInsuranceCount > 0 ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200/60 bg-white/80 px-3 py-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-800" aria-hidden />
              {pendingInsuranceCount} approved — insurance proof needed
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Upload market insurance for each approved booth before the organizer finalizes your spot.
            </p>
          </div>
          <Link
            href="/vendor/applications?filter=pending_insurance"
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
          >
            Upload insurance
          </Link>
        </div>
      ) : null}

      {paymentDueCount > 0 ? (
        <div
          className={cn(
            'flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-3',
            paymentUrgent
              ? 'border-terracotta-300/80 bg-terracotta-50/80'
              : 'border-harvest-200/60 bg-white/80'
          )}
        >
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              {paymentDueCount} booth payment{paymentDueCount === 1 ? '' : 's'} due
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {paymentUrgent
                ? 'Your payment deadline is approaching — unpaid booths may be released to the waitlist.'
                : 'Complete checkout to hold your booth — organizers see payment status in real time.'}
            </p>
            {nearestPaymentDueAt ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground">
                <Timer className="h-3.5 w-3.5 text-harvest-700" aria-hidden />
                {paymentDueCountdownLabel(nearestPaymentDueAt)} · due{' '}
                {formatPaymentDueAtDisplay(nearestPaymentDueAt)}
              </p>
            ) : null}
          </div>
          <Link href="/vendor/applications" className={buttonVariants({ size: 'sm' })}>
            Pay now
          </Link>
        </div>
      ) : null}
    </section>
  )
}
