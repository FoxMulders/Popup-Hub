'use client'

import { ArrowLeft, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { processMaterialChecklist } from '@/lib/experience-designer/material-checklist'
import type { RoomZone } from '@/lib/experience-designer/types'
import { MaterialChecklistPanel } from '@/components/experience-designer/inspector/material-checklist-panel'

export interface ZoneInspectorPanelProps {
  zone: RoomZone
  onBack: () => void
}

export function ZoneInspectorPanel({ zone, onBack }: ZoneInspectorPanelProps) {
  const checklistItems =
    zone.materialChecklist?.length
      ? zone.materialChecklist
      : zone.bom?.length
        ? processMaterialChecklist(zone.bom.map((line) => line.name))
        : []

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

        {checklistItems.length ? (
          <MaterialChecklistPanel items={checklistItems} />
        ) : zone.puzzleTitle ? (
          <p className="text-xs text-white/45">
            No materials listed yet for this puzzle zone.
          </p>
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
            Generate puzzles in step 3 to populate materials and Arduino previews for puzzle zones.
          </p>
        )}
      </div>
    </div>
  )
}
