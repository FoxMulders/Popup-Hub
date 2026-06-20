'use client'

import Link from 'next/link'
import { FlaskConical, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface DemoMarketGuideBannerProps {
  active?: boolean
  className?: string
}

export function DemoMarketGuideBanner({ active = false, className }: DemoMarketGuideBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (!active || dismissed) return null

  return (
    <div
      className={cn(
        'relative rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm',
        className
      )}
      role="status"
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-sky-100 hover:text-foreground"
        aria-label="Dismiss demo guide"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <p className="inline-flex items-center gap-2 pr-8 font-semibold text-foreground">
        <FlaskConical className="h-4 w-4 text-sky-700" aria-hidden />
        Demo market — ~10 minute tour
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground leading-relaxed">
        <li>Confirm dates and venue on this step (already filled for you).</li>
        <li>
          Open{' '}
          <Link href="/coordinator/studio" className="font-medium text-sky-900 hover:underline">
            HubGrid
          </Link>{' '}
          and place a few vendor booths in <span className="font-medium text-foreground">Simple</span>{' '}
          mode.
        </li>
        <li>Assign a vendor from the ledger, then publish when you are ready.</li>
      </ol>
    </div>
  )
}
