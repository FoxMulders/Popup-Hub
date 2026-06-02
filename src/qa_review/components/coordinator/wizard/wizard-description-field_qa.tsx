'use client'

import { cn } from '@/lib/utils'
import { DESCRIPTION_MIN_LENGTH } from '@/lib/wizard/critique/copy-audit'
import { WizardFloatingTextarea } from '@/components/coordinator/wizard/wizard-ui'

export interface WizardDescriptionFieldQaProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
  rows?: number
}

/**
 * Description field with metrics and helper copy in a separate block below the
 * floating textarea so labels and counts never overlap the input.
 */
export function WizardDescriptionFieldQa({
  id,
  label,
  value,
  onChange,
  maxLength = 800,
  rows = 4,
}: WizardDescriptionFieldQaProps) {
  const trimmedLen = value.trim().length
  const belowMin = trimmedLen < DESCRIPTION_MIN_LENGTH

  return (
    <div className="wizard-description-field-qa space-y-2">
      <WizardFloatingTextarea
        id={id}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        className="min-h-[6.5rem] pb-2"
      />
      <div
        className="flex flex-col gap-1.5 border-t border-stone-200/60 pt-2"
        aria-live="polite"
      >
        <p
          className={cn(
            'text-xs tabular-nums leading-snug',
            belowMin ? 'text-harvest-700' : 'text-muted-foreground'
          )}
        >
          <span className="font-medium">
            {trimmedLen} / {DESCRIPTION_MIN_LENGTH} min
          </span>
          <span className="mx-1.5 text-stone-300" aria-hidden>
            ·
          </span>
          <span>
            {value.length} / {maxLength}
          </span>
        </p>
        {belowMin ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Mention vendor mix, neighborhood, and what makes the market worth visiting.
          </p>
        ) : null}
      </div>
    </div>
  )
}
