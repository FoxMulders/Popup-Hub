'use client'

import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { DESCRIPTION_MIN_LENGTH } from '@/lib/wizard/critique/copy-audit'
import { WIZARD_FIELD_LABEL } from '@/lib/wizard/wizard-panel-styles'

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
      <label htmlFor={id} className={cn(WIZARD_FIELD_LABEL, 'mb-2 block')}>
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        className="field-sizing-fixed w-full min-h-[150px] resize-y overflow-y-auto rounded-md border border-slate-300 p-3 focus:ring-2 focus:ring-blue-500"
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
