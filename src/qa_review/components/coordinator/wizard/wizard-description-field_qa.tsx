'use client'

import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { DESCRIPTION_MIN_LENGTH } from '@/lib/wizard/critique/copy-audit'
import { WIZARD_FIELD_LABEL, WIZARD_TEXTAREA } from '@/lib/wizard/wizard-panel-styles'

export interface WizardDescriptionFieldQaProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
  rows?: number
}

/**
 * Description field with a static label above the textarea and metrics in a
 * separate block below so labels and counts never overlap the input.
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
    <div className="wizard-description-field-qa flex min-h-0 flex-col space-y-2">
      <label htmlFor={id} className={cn(WIZARD_FIELD_LABEL, 'block')}>
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        className={cn(
          WIZARD_TEXTAREA,
          'field-sizing-fixed min-h-[5rem] resize-y overflow-y-auto px-3 pt-3 pb-2.5'
        )}
      />
      <div
        className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-stone-200/60 pt-2"
        aria-live="polite"
      >
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
          {belowMin
            ? 'Mention vendor mix, neighborhood, and what makes the market worth visiting.'
            : '\u00a0'}
        </p>
        <p
          className={cn(
            'ml-auto shrink-0 text-right text-xs tabular-nums leading-snug',
            belowMin ? 'text-harvest-700' : 'text-muted-foreground'
          )}
        >
          {trimmedLen}/{DESCRIPTION_MIN_LENGTH} min · {value.length}/{maxLength}
        </p>
      </div>
    </div>
  )
}
