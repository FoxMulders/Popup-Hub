'use client'

import { LayoutGrid } from 'lucide-react'
import { ELEMENT_STYLES, VENUE_ELEMENT_TOOLS } from '@/lib/booth-planner/venue-elements'
import {
  toolShortcutMeta,
  type LayoutTool,
} from '@/lib/booth-planner/layout-tool-shortcuts'
import type { VenueElementType } from '@/types/database'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { cn } from '@/lib/utils'

interface VenueFixturesCatalogProps {
  activeTool: LayoutTool
  onToolChange: (tool: LayoutTool) => void
}

const VENDOR_SWATCH_CLASS = 'bg-harvest-50 border-2 border-harvest-700'

/** Single-line catalog labels for the 20% left rail (tooltips keep full names). */
const CATALOG_DISPLAY_LABEL: Partial<Record<LayoutTool, string>> = {
  stage: 'Stage',
  food_court: 'Food/Concession',
  seating: 'Seating/Tables',
  exit: 'Emerg. Exit X',
  column: 'Wall / Column W',
}

/** Tools whose shortcut is merged into the display label (no separate kbd badge). */
const MERGED_SHORTCUT_TOOLS = new Set<LayoutTool>(['exit', 'column'])

const TOOL_SHORT_LABEL = Object.fromEntries(
  VENUE_ELEMENT_TOOLS.map((t) => [t.type, t.shortLabel])
) as Partial<Record<LayoutTool, string>>

function catalogDisplayLabel(tool: LayoutTool, fallback: string): string {
  return CATALOG_DISPLAY_LABEL[tool] ?? TOOL_SHORT_LABEL[tool] ?? fallback
}

const CATALOG_ENTRIES: { tool: LayoutTool; label: string; swatchClassName: string; vendor?: boolean }[] = [
  { tool: 'vendor', label: 'Vendor Booth', swatchClassName: VENDOR_SWATCH_CLASS, vendor: true },
  ...VENUE_ELEMENT_TOOLS.filter((t) => t.type !== 'eraser').map((t) => ({
    tool: t.type as LayoutTool,
    label: t.label,
    swatchClassName: ELEMENT_STYLES[t.type as VenueElementType].className,
  })),
]

export function VenueFixturesCatalog({ activeTool, onToolChange }: VenueFixturesCatalogProps) {
  return (
    <aside className="market-panel p-3 space-y-2" aria-label="Venue fixtures catalog">
      <TooltipWrapper text="Press a letter key to switch tools. Ctrl+Z undo · Ctrl+Shift+Z redo.">
        <p className="text-[10px] font-heading font-semibold text-muted-foreground uppercase tracking-wide cursor-default">
          Venue fixtures
        </p>
      </TooltipWrapper>
      <div className="flex flex-col gap-1.5" role="toolbar" aria-label="Fixture tools">
        {CATALOG_ENTRIES.map(({ tool, label, swatchClassName, vendor }) => {
          const active = activeTool === tool
          const meta = toolShortcutMeta(tool)
          const displayLabel = catalogDisplayLabel(tool, label)
          const tip = meta
            ? `${meta.label} — ${meta.description}${meta.shortcut ? ` · ${meta.shortcut}` : ''}`
            : label
          const showKbd = meta?.shortcut && !MERGED_SHORTCUT_TOOLS.has(tool)

          return (
            <TooltipWrapper key={tool} text={tip} className="w-full">
              <button
                type="button"
                aria-pressed={active}
                aria-keyshortcuts={meta?.shortcut || undefined}
                aria-label={label}
                onClick={() => onToolChange(tool)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-none border-2 border-black px-2 py-1.5 min-h-9 text-left transition-all duration-200',
                  active
                    ? 'bg-zinc-900 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ring-2 ring-slate-500 ring-offset-1'
                    : 'bg-white hover:bg-zinc-100 active:translate-y-0.5'
                )}
              >
                {vendor ? (
                  <span
                    className={cn(
                      'inline-flex h-5 w-8 shrink-0 items-center justify-center rounded',
                      swatchClassName
                    )}
                  >
                    <LayoutGrid className="h-3 w-3 text-harvest-700" />
                  </span>
                ) : (
                  <span className={cn('h-5 w-8 shrink-0 rounded', swatchClassName)} />
                )}
                <span className="min-w-0 flex-1 truncate text-[11px] font-black">{displayLabel}</span>
                {showKbd ? (
                  <kbd
                    className={cn(
                      'ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-none border-2 border-black px-1 text-[10px] font-black',
                      active ? 'bg-white text-black' : 'bg-zinc-900 text-white'
                    )}
                  >
                    {meta!.shortcut}
                  </kbd>
                ) : null}
              </button>
            </TooltipWrapper>
          )
        })}
      </div>
    </aside>
  )
}

/** @deprecated Use VenueFixturesCatalog */
export const VenueLayoutLegend = VenueFixturesCatalog
