'use client'

import { AlertTriangle } from 'lucide-react'
import {
  LAYOUT_GUARDRAILS_EXPLANATION,
  type DocLayoutAlertsSummary,
} from '@/lib/floor-plan/layout-guardrails/summarize-doc-layout-alerts'
import { MELT_ZONE_THEME } from '@/lib/floor-plan/layout-guardrails/melt-zone-rules'
import { cn } from '@/lib/utils'

interface LayoutGuardrailsPanelProps {
  summary: DocLayoutAlertsSummary
  className?: string
  docked?: boolean
}

export function LayoutGuardrailsPanel({
  summary,
  className,
  docked = false,
}: LayoutGuardrailsPanelProps) {
  const { meltZoneCount, clusterAlertCount, meltZoneIssues, clusterAlerts } = summary
  const hasIssues = meltZoneCount + clusterAlertCount > 0
  if (!hasIssues) return null

  const meltSample = meltZoneIssues.slice(0, docked ? 2 : 3)
  const clusterSample = clusterAlerts.slice(0, docked ? 2 : 3)

  return (
    <article
      className={cn(
        'rounded-lg border-2 border-orange-400/80 bg-orange-50/95 text-orange-950',
        docked ? 'mt-2 space-y-1.5 p-2' : 'space-y-2 p-3',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={cn('shrink-0 text-orange-700', docked ? 'mt-0.5 h-3.5 w-3.5' : 'mt-0.5 h-4 w-4')}
          aria-hidden
        />
        <div className="min-w-0 space-y-2">
          {meltZoneCount > 0 ? (
            <div className="space-y-1">
              <h3
                className={cn(
                  'font-heading font-semibold uppercase tracking-wide text-orange-900',
                  docked ? 'text-[9px]' : 'text-xs'
                )}
              >
                {LAYOUT_GUARDRAILS_EXPLANATION.meltZoneTitle}
              </h3>
              <p className={cn('leading-snug text-orange-900/90', docked ? 'text-[10px]' : 'text-xs')}>
                <span className="font-semibold">
                  {meltZoneCount} melt-sensitive booth{meltZoneCount === 1 ? '' : 's'}
                </span>
                {' — '}
                {LAYOUT_GUARDRAILS_EXPLANATION.meltZoneDetail}
              </p>
              {meltSample.length > 0 ? (
                <ul
                  className={cn(
                    'list-inside list-disc space-y-0.5 text-orange-900/85',
                    docked ? 'text-[10px]' : 'text-xs'
                  )}
                >
                  {meltSample.map((issue) => (
                    <li key={`${issue.boothId}:${issue.heatSourceId}`}>
                      {issue.kind === 'outdoor_exposure' ? (
                        <>
                          {issue.boothLabel} on open lot — prefer indoor/covered placement
                        </>
                      ) : (
                        <>
                          {issue.boothLabel} ({issue.categoryName}) near {issue.heatSourceLabel}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {clusterAlertCount > 0 ? (
            <div className="space-y-1">
              <h3
                className={cn(
                  'font-heading font-semibold uppercase tracking-wide text-orange-900',
                  docked ? 'text-[9px]' : 'text-xs'
                )}
              >
                {LAYOUT_GUARDRAILS_EXPLANATION.clusterTitle}
              </h3>
              <p className={cn('leading-snug text-orange-900/90', docked ? 'text-[10px]' : 'text-xs')}>
                {LAYOUT_GUARDRAILS_EXPLANATION.clusterIntro}{' '}
                {LAYOUT_GUARDRAILS_EXPLANATION.clusterDetail}
              </p>
              {clusterSample.length > 0 ? (
                <ul
                  className={cn(
                    'list-inside list-disc space-y-0.5 text-orange-900/85',
                    docked ? 'text-[10px]' : 'text-xs'
                  )}
                >
                  {clusterSample.map((alert) => (
                    <li key={alert.anchorBoothId}>
                      {alert.boothCount}× {alert.categoryName}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <p
            className={cn('leading-snug text-orange-800/80', docked ? 'text-[9px]' : 'text-[10px]')}
            style={{ borderLeft: `3px solid ${MELT_ZONE_THEME.stroke}` }}
          >
            Advisory only — these warnings do not block publish.
          </p>
        </div>
      </div>
    </article>
  )
}
