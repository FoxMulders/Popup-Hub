'use client'

import { FlaskConical } from 'lucide-react'
import { DismissibleAlertCard } from '@/components/coordinator/dismissible-alert-card'
import type { WizardCritiqueFinding } from '@/lib/wizard/critique/use-wizard-critique-agents'
import { WIZARD_SECTION_LABEL } from '@/lib/wizard/wizard-panel-styles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PERSONA_LABELS: Record<WizardCritiqueFinding['persona'], string> = {
  copy: 'English Teacher Audit',
  ui: 'Website Critique',
  engine: 'Functionality Engineer',
}

interface WizardQaSidebarPanelProps {
  findings: WizardCritiqueFinding[]
  onDismiss: (id: string) => void
  onGoToStep?: (step: number) => void
  className?: string
}

export function WizardQaSidebarPanel({
  findings,
  onDismiss,
  onGoToStep,
  className,
}: WizardQaSidebarPanelProps) {
  return (
    <div className={cn('market-panel flex flex-col gap-2 p-3', className)} aria-label="QA Desk">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200/80 pb-1.5">
        <h3 className={cn(WIZARD_SECTION_LABEL, 'flex items-center gap-1.5')}>
          <FlaskConical className="h-3.5 w-3.5" />
          QA Desk
        </h3>
        {findings.length > 0 ? (
          <span className="rounded-full bg-terracotta-500 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
            {findings.length}
          </span>
        ) : null}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Audits refresh when layout or event details change.
      </p>
      {findings.length === 0 ? (
        <p className="text-xs font-medium text-forest">No active findings.</p>
      ) : (
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {findings.map((f) => (
            <DismissibleAlertCard
              key={f.id}
              alertId={f.id}
              title={`${PERSONA_LABELS[f.persona]}: ${f.title}`}
              variant={f.severity === 'error' ? 'error' : f.severity === 'warning' ? 'warning' : 'info'}
              dismissed={false}
              onDismiss={onDismiss}
            >
              <p className="text-xs leading-relaxed whitespace-normal break-words">{f.message}</p>
              {f.actionStep && onGoToStep ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-[10px]"
                  onClick={() => onGoToStep(f.actionStep!)}
                >
                  Go to Step {f.actionStep}
                </Button>
              ) : null}
            </DismissibleAlertCard>
          ))}
        </div>
      )}
    </div>
  )
}
