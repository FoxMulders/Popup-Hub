'use client'

import Link from 'next/link'
import { Check, Circle, CircleDot, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildVendorBookingSteps,
  type VendorBookingStep,
} from '@/lib/vendor/vendor-booking-steps'
import { vendorSetupMapUrl } from '@/lib/shopper/public-floorplan-modes'
import type { BoothApplication } from '@/types/database'

interface VendorBookingProgressRailProps {
  application: BoothApplication
  className?: string
  compact?: boolean
}

function StepIcon({ state }: { state: VendorBookingStep['state'] }) {
  if (state === 'complete') {
    return <Check className="h-3.5 w-3.5 text-sage-700" strokeWidth={3} aria-hidden />
  }
  if (state === 'current') {
    return <CircleDot className="h-3.5 w-3.5 text-harvest-600" aria-hidden />
  }
  if (state === 'blocked') {
    return <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
  }
  return <Circle className="h-3 w-3 text-stone-300" aria-hidden />
}

export function VendorBookingProgressRail({
  application,
  className,
  compact = false,
}: VendorBookingProgressRailProps) {
  const steps = buildVendorBookingSteps(application)

  return (
    <div
      className={cn('rounded-xl border border-stone-200/80 bg-canvas/40 p-3', className)}
      aria-label="Booking progress"
    >
      {!compact ? (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Your booking path
        </p>
      ) : null}
      <ol className="grid gap-2 sm:grid-cols-4 sm:gap-1">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={cn(
              'flex gap-2 sm:flex-col sm:items-center sm:text-center',
              index < steps.length - 1 && 'sm:relative'
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                step.state === 'complete' && 'border-sage-200 bg-sage-50',
                step.state === 'current' && 'border-harvest-300 bg-harvest-50',
                step.state === 'upcoming' && 'border-stone-200 bg-white',
                step.state === 'blocked' && 'border-stone-200 bg-stone-100'
              )}
            >
              <StepIcon state={step.state} />
            </span>
            <span className="min-w-0 flex-1 sm:flex-none">
              {step.key === 'booth' &&
              step.state === 'complete' &&
              application.booth_number != null ? (
                <Link
                  href={vendorSetupMapUrl(application.event_id)}
                  className="block text-xs font-medium leading-snug text-forest hover:underline"
                >
                  {step.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'block text-xs font-medium leading-snug',
                    step.state === 'current' ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              )}
              {!compact ? (
                <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">
                  {step.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
