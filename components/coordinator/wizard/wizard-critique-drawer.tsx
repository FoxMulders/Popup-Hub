'use client'

import { useState } from 'react'
import { FlaskConical, PanelRightOpen } from 'lucide-react'
import { DismissibleAlertCard } from '@/components/coordinator/dismissible-alert-card'
import type { WizardCritiqueFinding } from '@/lib/wizard/critique/use-wizard-critique-agents'
import { WIZARD_PANEL } from '@/lib/wizard/wizard-panel-styles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PERSONA_LABELS: Record<WizardCritiqueFinding['persona'], string> = {
  copy: 'English Teacher Audit',
  ui: 'Website Critique',
  engine: 'Functionality Engineer',
}

interface WizardCritiqueDrawerProps {
  findings: WizardCritiqueFinding[]
  onDismiss: (id: string) => void
}

export function WizardCritiqueDrawer({ findings, onDismiss }: WizardCritiqueDrawerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="fixed bottom-6 right-6 z-50 min-h-11 gap-2 shadow-[var(--shadow-market)]"
        onClick={() => setOpen((v) => !v)}
      >
        <FlaskConical className="h-4 w-4" />
        QA Desk
        {findings.length > 0 ? (
          <span className="rounded-full bg-terracotta-500 text-white text-[10px] px-1.5 py-0.5 font-bold">
            {findings.length}
          </span>
        ) : null}
      </Button>

      <div
        className={cn(
          'fixed top-0 right-0 z-40 h-full w-full max-w-md border-l-2 border-stone-200 bg-card shadow-[var(--shadow-market-md)] transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-hidden={!open}
      >
        <div className={cn(WIZARD_PANEL, 'm-4 p-4 space-y-3 h-[calc(100%-2rem)] overflow-y-auto')}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-heading font-semibold uppercase tracking-wide text-forest flex items-center gap-2">
              <PanelRightOpen className="h-4 w-4" />
              3-Persona QA Desk
            </h2>
            <button
              type="button"
              aria-label="Close QA desk"
              className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-stone-200 bg-card text-base font-bold hover:bg-canvas transition-all duration-200"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-muted-foreground whitespace-normal break-words">
            Automated audits run after each input change — copy clarity, UI hierarchy, and engine safety.
          </p>
          {findings.length === 0 ? (
            <p className="text-sm text-forest font-medium">No active findings.</p>
          ) : (
            findings.map((f) => (
              <DismissibleAlertCard
                key={f.id}
                alertId={f.id}
                title={`${PERSONA_LABELS[f.persona]}: ${f.title}`}
                variant={f.severity === 'error' ? 'error' : f.severity === 'warning' ? 'warning' : 'info'}
                dismissed={false}
                onDismiss={onDismiss}
              >
                <p className="text-xs leading-relaxed whitespace-normal break-words">{f.message}</p>
              </DismissibleAlertCard>
            ))
          )}
        </div>
      </div>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/20"
          aria-label="Close QA desk overlay"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
