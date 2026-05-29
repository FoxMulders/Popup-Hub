'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { getWeekendScheduleRange } from '@/lib/shopper/weekend-schedule'
import { cn } from '@/lib/utils'

interface ScheduleWeekendShortcutsProps {
  scheduleType: 'single' | 'multi'
  onApply: (range: { startDate: string; endDate: string }) => void
  disabled?: boolean
  /** Wizard shell — spring selection cards instead of outline buttons. */
  variant?: 'default' | 'wizard'
}

function WizardQuickDateCard({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'wizard-selection-card min-h-9 px-3 py-2 text-xs',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 22 }}
    >
      {label}
    </motion.button>
  )
}

export function ScheduleWeekendShortcuts({
  scheduleType,
  onApply,
  disabled,
  variant = 'default',
}: ScheduleWeekendShortcutsProps) {
  function apply(which: 'this' | 'next') {
    const range = getWeekendScheduleRange(which)
    if (scheduleType === 'single') {
      onApply({ startDate: range.startDate, endDate: range.startDate })
      return
    }
    onApply({ startDate: range.startDate, endDate: range.endDate })
  }

  if (variant === 'wizard') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="wizard-field-label">Quick dates</span>
        <WizardQuickDateCard label="This Weekend" disabled={disabled} onClick={() => apply('this')} />
        <WizardQuickDateCard label="Next Weekend" disabled={disabled} onClick={() => apply('next')} />
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Quick dates
      </span>
      <button
        type="button"
        disabled={disabled}
        className="min-h-9 rounded-lg border-2 border-stone-200 bg-card px-3 text-sm disabled:opacity-50"
        onClick={() => apply('this')}
      >
        This Weekend
      </button>
      <button
        type="button"
        disabled={disabled}
        className="min-h-9 rounded-lg border-2 border-stone-200 bg-card px-3 text-sm disabled:opacity-50"
        onClick={() => apply('next')}
      >
        Next Weekend
      </button>
    </div>
  )
}
