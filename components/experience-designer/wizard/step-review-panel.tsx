'use client'

import { CheckCircle2 } from 'lucide-react'
import { PanelHeader } from '@/components/experience-designer/wizard/step-constraints-panel'
import type { ExperienceConstraints, RoomSkeleton } from '@/lib/experience-designer/types'

export interface StepReviewPanelProps {
  constraints: ExperienceConstraints
  roomSkeleton: RoomSkeleton | null
  puzzlesGenerated: boolean
}

export function StepReviewPanel({
  constraints,
  roomSkeleton,
  puzzlesGenerated,
}: StepReviewPanelProps) {
  const zoneCount = roomSkeleton?.zones.length ?? 0
  const puzzleZones =
    roomSkeleton?.zones.filter((z) => z.zoneType === 'puzzle' || z.zoneType === 'climax')
      .length ?? 0
  const connectionCount = roomSkeleton?.connections.length ?? 0

  const checklist = [
    { label: 'Constraints locked', done: true },
    { label: 'Architectural skeleton generated', done: zoneCount > 0 },
    { label: 'Puzzles and BOM assigned', done: puzzlesGenerated },
    { label: 'Flow paths validated', done: connectionCount > 0 },
  ]

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        step={4}
        title="Final review"
        subtitle="Validate the experience blueprint before export or fabrication."
      />
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Summary
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-white/45">Zones</dt>
              <dd className="font-semibold tabular-nums text-white">{zoneCount}</dd>
            </div>
            <div>
              <dt className="text-white/45">Puzzle rooms</dt>
              <dd className="font-semibold tabular-nums text-white">{puzzleZones}</dd>
            </div>
            <div>
              <dt className="text-white/45">Connections</dt>
              <dd className="font-semibold tabular-nums text-white">{connectionCount}</dd>
            </div>
            <div>
              <dt className="text-white/45">Players</dt>
              <dd className="font-semibold tabular-nums text-white">
                {constraints.targetPlayerCount}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Readiness checklist
          </p>
          <ul className="mt-2 space-y-2">
            {checklist.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs"
              >
                <CheckCircle2
                  className={
                    item.done ? 'h-4 w-4 text-emerald-400' : 'h-4 w-4 text-white/20'
                  }
                />
                <span className={item.done ? 'text-white/80' : 'text-white/40'}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
