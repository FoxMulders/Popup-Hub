import Link from 'next/link'
import { FileWarning, ShieldCheck } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface VendorActionRequiredBannerProps {
  pendingInsuranceCount: number
  paymentDueCount: number
  className?: string
}

export function VendorActionRequiredBanner({
  pendingInsuranceCount,
  paymentDueCount,
  className,
}: VendorActionRequiredBannerProps) {
  if (pendingInsuranceCount === 0 && paymentDueCount === 0) return null

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
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-harvest-200/60 bg-white/80 px-3 py-3">
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              {paymentDueCount} booth payment{paymentDueCount === 1 ? '' : 's'} due
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Complete checkout to hold your booth — organizers see payment status in real time.
            </p>
          </div>
          <Link href="/vendor/applications" className={buttonVariants({ size: 'sm' })}>
            Pay now
          </Link>
        </div>
      ) : null}
    </section>
  )
}
