'use client'

import { LAYOUT_AI_PRESET_OPTIONS, type LayoutPreset } from '@/lib/booth-planner/layout-presets'
import { cn } from '@/lib/utils'
import { Check, Eraser } from 'lucide-react'

interface LayoutPresetPickerProps {
  value: LayoutPreset
  onChange: (preset: LayoutPreset) => void
  /** Sidebar stack — label above control, no inline description. */
  compact?: boolean
  /** Single-row dock — label beside control. */
  inline?: boolean
  disabled?: boolean
  applying?: boolean
  /**
   * Optional handler for the "Clear Layout Preset" action. When provided,
   * renders a button below the preset list that fully resets the canvas
   * shell back to a default empty grid and unselects any active preset.
   */
  onClear?: () => void
}

const CLEARED_PRESET: LayoutPreset = 'default'

export function LayoutPresetPicker({
  value,
  onChange,
  compact = false,
  inline = false,
  disabled = false,
  applying = false,
  onClear,
}: LayoutPresetPickerProps) {
  const options = LAYOUT_AI_PRESET_OPTIONS

  if (inline) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <label className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Preset
        </label>
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as LayoutPreset)}
          className="min-w-[8.5rem] max-w-[11rem] rounded-lg border-2 border-stone-200 bg-field-surface px-1.5 py-0.5 text-[11px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-forest/30 disabled:opacity-60"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2', compact ? 'min-w-0' : 'min-w-[180px]')}>
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Layout preset
        </h3>
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
          No preset is active by default — pick one to auto-paint aisles, or hand-draw your own
          layout. Click <span className="font-semibold">Clear layout preset</span> to wipe the
          canvas back to a blank shell.
        </p>
      </div>

      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Layout preset">
        {options.map((opt) => {
          const isSelected = opt.id === value
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={cn(
                'rounded-xl border-2 px-2.5 py-2 text-left transition-colors disabled:cursor-wait disabled:opacity-60',
                isSelected
                  ? 'border-forest bg-forest/10 shadow-[var(--shadow-market)]'
                  : 'border-stone-200 bg-white hover:border-stone-400'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                {isSelected ? (
                  applying ? (
                    <span className="text-[10px] font-medium text-forest">Applying…</span>
                  ) : (
                    <Check className="h-3.5 w-3.5 shrink-0 text-forest" aria-hidden />
                  )
                ) : null}
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{opt.description}</p>
            </button>
          )
        })}
      </div>

      {onClear ? (
        <button
          type="button"
          disabled={disabled || applying}
          onClick={onClear}
          className={cn(
            /* Editorial secondary action — soft cream surface, dark text, terracotta hover. */
            'mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-stone-300 bg-cream px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors',
            'hover:border-terracotta-500 hover:bg-terracotta-50 hover:text-terracotta-800',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-stone-300 disabled:hover:bg-cream disabled:hover:text-foreground'
          )}
          title="Reset preset selection and wipe the canvas to a default empty grid"
          aria-label="Clear layout preset"
          aria-pressed={value === CLEARED_PRESET}
        >
          <Eraser className="h-3.5 w-3.5" aria-hidden />
          Clear layout preset
        </button>
      ) : null}
    </div>
  )
}
