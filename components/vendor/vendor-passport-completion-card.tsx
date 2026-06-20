import Link from 'next/link'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import type { VendorPassportCompletionMeter } from '@/lib/passport/vendor-passport-completion'
import { cn } from '@/lib/utils'

interface VendorPassportCompletionCardProps {
  meter: VendorPassportCompletionMeter
  businessName?: string | null
  className?: string
}

export function VendorPassportCompletionCard({
  meter,
  businessName,
  className,
}: VendorPassportCompletionCardProps) {
  if (meter.complete) return null

  return (
    <section
      className={cn(
        'rounded-xl border border-harvest-200/80 bg-white px-4 py-4 shadow-sm sm:px-5',
        className
      )}
      aria-labelledby="vendor-passport-completion"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            id="vendor-passport-completion"
            className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <ClipboardList className="h-4 w-4 text-harvest-700" aria-hidden />
            Finish your passport to apply
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {businessName?.trim()
              ? `${businessName.trim()} is almost ready — complete the items below before applying to juried markets.`
              : 'Organizers review your passport on every application. Complete the basics first.'}
          </p>
        </div>
        <span className="text-lg font-bold tabular-nums text-forest">{meter.percent}%</span>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-valuenow={meter.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Passport completion"
      >
        <div
          className="h-full rounded-full bg-forest transition-[width] duration-300"
          style={{ width: `${meter.percent}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        {meter.steps
          .filter((step) => !step.complete)
          .map((step) => (
            <li key={step.id}>
              · {step.label}
              {step.required ? '' : ' (optional)'}
            </li>
          ))}
      </ul>

      <Link href="/vendor/passport" className={cn(buttonVariants({ size: 'sm' }), 'mt-4 gap-1.5')}>
        Complete passport
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </section>
  )
}
