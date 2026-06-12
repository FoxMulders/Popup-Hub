'use client'

import { AlertTriangle } from 'lucide-react'
import {
  BOOTH_CLEARANCE_WARNING_EXPLANATION,
  formatClearanceFeet,
  type DocClearanceSummary,
} from '@/lib/coordinator/booth-clearance-summary'
import { cn } from '@/lib/utils'

interface BoothClearanceWarningPanelProps {
  summary: DocClearanceSummary
  className?: string
  /** Compact copy for the legend side rail. */
  docked?: boolean
}

export function BoothClearanceWarningPanel({
  summary,
  className,
  docked = false,
}: BoothClearanceWarningPanelProps) {
  const { criticalCount, tightCount, issues } = summary
  const hasIssues = criticalCount + tightCount > 0
  if (!hasIssues) return null

  const sample = issues.slice(0, docked ? 3 : 5)

  return (
    <article
      className={cn(
        'rounded-lg border-2 border-harvest-400/80 bg-harvest-50/95 text-harvest-950',
        docked ? 'mt-2 space-y-1.5 p-2' : 'space-y-2 p-3',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={cn('shrink-0 text-harvest-700', docked ? 'mt-0.5 h-3.5 w-3.5' : 'mt-0.5 h-4 w-4')}
          aria-hidden
        />
        <div className="min-w-0 space-y-1.5">
          <h3
            className={cn(
              'font-heading font-semibold uppercase tracking-wide text-harvest-900',
              docked ? 'text-[9px]' : 'text-xs'
            )}
          >
            {BOOTH_CLEARANCE_WARNING_EXPLANATION.title}
          </h3>
          <p className={cn('leading-snug text-harvest-900/90', docked ? 'text-[10px]' : 'text-xs')}>
            {criticalCount > 0 ? (
              <>
                <span className="font-semibold">
                  {criticalCount} booth{criticalCount === 1 ? '' : 's'} in red
                </span>
                {' — '}
                {BOOTH_CLEARANCE_WARNING_EXPLANATION.red}
              </>
            ) : null}
            {criticalCount > 0 && tightCount > 0 ? ' ' : null}
            {tightCount > 0 ? (
              <>
                <span className="font-semibold">
                  {tightCount} booth{tightCount === 1 ? '' : 's'} in yellow
                </span>
                {' — '}
                {BOOTH_CLEARANCE_WARNING_EXPLANATION.yellow}
              </>
            ) : null}
          </p>
          <p className={cn('leading-snug text-harvest-800/85', docked ? 'text-[10px]' : 'text-xs')}>
            {BOOTH_CLEARANCE_WARNING_EXPLANATION.intro}{' '}
            {BOOTH_CLEARANCE_WARNING_EXPLANATION.green}
          </p>
          {sample.length > 0 ? (
            <ul
              className={cn(
                'list-inside list-disc space-y-0.5 text-harvest-900/90',
                docked ? 'text-[10px]' : 'text-[11px]'
              )}
            >
              {sample.map((row) => (
                <li key={row.id}>
                  <span className="font-medium">{row.label}</span>
                  {' — '}
                  {formatClearanceFeet(row.minClearanceFt)} to nearest obstacle (
                  {row.band === 'critical' ? 'red' : 'yellow'})
                </li>
              ))}
              {issues.length > sample.length ? (
                <li className="list-none text-harvest-800/80">
                  +{issues.length - sample.length} more
                </li>
              ) : null}
            </ul>
          ) : null}
          <p
            className={cn(
              'border-t border-harvest-300/60 pt-1.5 leading-snug text-harvest-800/90',
              docked ? 'text-[9px]' : 'text-[10px]'
            )}
          >
            {BOOTH_CLEARANCE_WARNING_EXPLANATION.toggleHint}
          </p>
        </div>
      </div>
    </article>
  )
}
