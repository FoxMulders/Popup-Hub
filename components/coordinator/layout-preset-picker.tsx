'use client'

import { LAYOUT_AI_PRESET_OPTIONS, type LayoutPreset } from '@/lib/booth-planner/layout-presets'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface LayoutPresetPickerProps {
  value: LayoutPreset
  onChange: (preset: LayoutPreset) => void
  /** Sidebar stack — label above control, no inline description. */
  compact?: boolean
  /** Single-row dock — label beside control. */
  inline?: boolean
}

export function LayoutPresetPicker({
  value,
  onChange,
  compact = false,
  inline = false,
}: LayoutPresetPickerProps) {
  const options = LAYOUT_AI_PRESET_OPTIONS

  if (inline) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <label className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-black">
          Preset
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as LayoutPreset)}
          className="min-w-[8.5rem] max-w-[11rem] rounded-lg border-2 border-black px-1.5 py-0.5 text-[11px] font-semibold text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
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
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-black">
          Layout preset
        </h3>
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
          AI auto-plan shell — paints aisles and clears booths when changed.
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
              onClick={() => onChange(opt.id)}
              className={cn(
                'rounded-xl border-2 px-2.5 py-2 text-left transition-colors',
                isSelected
                  ? 'border-forest bg-forest/10 shadow-[var(--shadow-market)]'
                  : 'border-stone-200 bg-white hover:border-stone-400'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-black">{opt.label}</span>
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-forest" aria-hidden /> : null}
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{opt.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
