'use client'

import { ArrowLeft, Cpu, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RoomZone } from '@/lib/experience-designer/types'

export interface ZoneInspectorPanelProps {
  zone: RoomZone
  onBack: () => void
}

export function ZoneInspectorPanel({ zone, onBack }: ZoneInspectorPanelProps) {
  const bomTotalCents =
    zone.bom?.reduce((sum, line) => sum + line.quantity * line.unitCostCents, 0) ?? 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          className="text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Back to council telemetry"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{zone.name}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">{zone.zoneType}</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {zone.puzzleTitle ? (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Puzzle
            </p>
            <h3 className="mt-1 text-sm font-semibold text-white">{zone.puzzleTitle}</h3>
            {zone.puzzleSummary ? (
              <p className="mt-1 text-xs leading-relaxed text-white/60">{zone.puzzleSummary}</p>
            ) : null}
          </section>
        ) : null}

        {zone.bom?.length ? (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-300" />
              <h3 className="text-sm font-semibold text-white">Bill of Materials</h3>
            </div>
            <ul className="space-y-1.5">
              {zone.bom.map((line) => (
                <li
                  key={line.sku}
                  className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{line.name}</p>
                    <p className="text-white/40">{line.sku}</p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p className="text-white">×{line.quantity}</p>
                    <p className="text-white/45">
                      ${((line.unitCostCents * line.quantity) / 100).toFixed(2)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right text-xs tabular-nums text-white/50">
              Est. total ${(bomTotalCents / 100).toFixed(2)}
            </p>
          </section>
        ) : null}

        {zone.arduinoCode ? (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-sky-300" />
              <h3 className="text-sm font-semibold text-white">Arduino preview</h3>
            </div>
            <pre className="max-h-[280px] overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-emerald-200/90">
              <code>{zone.arduinoCode}</code>
            </pre>
          </section>
        ) : (
          <p className="text-xs text-white/45">
            Generate puzzles in step 3 to populate BOM and Arduino previews for puzzle zones.
          </p>
        )}
      </div>
    </div>
  )
}
