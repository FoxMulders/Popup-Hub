'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import type { ZoneNodeData } from '@/lib/experience-designer/room-skeleton-flow'
import { zoneNodeStyle } from '@/lib/experience-designer/room-skeleton-flow'

function ZoneNodeComponent({ data, selected }: NodeProps) {
  const zoneData = data as ZoneNodeData

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-lg border-2 bg-[#151b23] px-3 py-2.5 transition-shadow',
        selected && 'ring-2 ring-sky-400/80 ring-offset-2 ring-offset-[#0b0f14]'
      )}
      style={zoneNodeStyle(zoneData.zoneType)}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-400" />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
        {zoneData.zoneType}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-white">{zoneData.label}</p>
      {zoneData.hasPuzzle ? (
        <p className="mt-1 truncate text-xs text-sky-300">{zoneData.puzzleTitle}</p>
      ) : (
        <p className="mt-1 text-xs text-white/40">No puzzle assigned</p>
      )}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-slate-400" />
    </div>
  )
}

export const ZoneNode = memo(ZoneNodeComponent)
