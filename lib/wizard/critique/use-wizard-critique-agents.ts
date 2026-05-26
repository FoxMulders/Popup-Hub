'use client'

import { useEffect, useMemo, useState } from 'react'
import { runCopyAudit } from '@/lib/wizard/critique/copy-audit'
import { runUiAudit } from '@/lib/wizard/critique/ui-audit'
import { runEngineAudit } from '@/lib/wizard/critique/engine-audit'

export type CritiquePersona = 'copy' | 'ui' | 'engine'

export interface WizardCritiqueFinding {
  id: string
  persona: CritiquePersona
  severity: 'warning' | 'error' | 'info'
  title: string
  message: string
  actionStep?: number
}

export interface CritiqueSnapshot {
  currentStep: number
  eventName: string
  description: string
  hasOverlap: boolean
  undismissedAlertCount: number
  venueWidth: number
  venueLength: number
  templateWidth?: number
  templateLength?: number
  gridCols: number
  gridRows: number
  pinDropped: boolean
  iterationLimitHit: boolean
  qaRunning: boolean
  qaCancelled: boolean
  saveBlocked: boolean
}

export function useWizardCritiqueAgents(snapshot: CritiqueSnapshot, debounceMs = 300) {
  const [findings, setFindings] = useState<WizardCritiqueFinding[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        currentStep: snapshot.currentStep,
        eventName: snapshot.eventName,
        description: snapshot.description,
        hasOverlap: snapshot.hasOverlap,
        undismissedAlertCount: snapshot.undismissedAlertCount,
        venueWidth: snapshot.venueWidth,
        venueLength: snapshot.venueLength,
        templateWidth: snapshot.templateWidth,
        templateLength: snapshot.templateLength,
        gridCols: snapshot.gridCols,
        gridRows: snapshot.gridRows,
        pinDropped: snapshot.pinDropped,
        iterationLimitHit: snapshot.iterationLimitHit,
        qaRunning: snapshot.qaRunning,
        qaCancelled: snapshot.qaCancelled,
        saveBlocked: snapshot.saveBlocked,
      }),
    [snapshot]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const merged: WizardCritiqueFinding[] = [
        ...runCopyAudit({
          eventName: snapshot.eventName,
          description: snapshot.description,
          currentStep: snapshot.currentStep,
        }),
        ...runUiAudit({
          currentStep: snapshot.currentStep,
          hasOverlap: snapshot.hasOverlap,
          undismissedAlertCount: snapshot.undismissedAlertCount,
          venueWidth: snapshot.venueWidth,
          venueLength: snapshot.venueLength,
          templateWidth: snapshot.templateWidth,
          templateLength: snapshot.templateLength,
          gridCols: snapshot.gridCols,
          gridRows: snapshot.gridRows,
          pinDropped: snapshot.pinDropped,
        }),
        ...runEngineAudit({
          iterationLimitHit: snapshot.iterationLimitHit,
          qaRunning: snapshot.qaRunning,
          qaCancelled: snapshot.qaCancelled,
          hasOverlap: snapshot.hasOverlap,
          saveBlocked: snapshot.saveBlocked,
        }),
      ]
      setFindings(merged)
      // Drop stale dismissals so resolved warnings vanish from the panel immediately.
      setDismissed((prev) => {
        const activeIds = new Set(merged.map((f) => f.id))
        const next = new Set<string>()
        for (const id of prev) {
          if (activeIds.has(id)) next.add(id)
        }
        return next
      })
    }, debounceMs)
    return () => window.clearTimeout(timer)
  }, [fingerprint, debounceMs, snapshot])

  const visibleFindings = findings.filter((f) => !dismissed.has(f.id))

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id))
  }

  return { findings: visibleFindings, dismiss, allFindings: findings }
}
