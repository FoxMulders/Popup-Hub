'use client'

import { Ruler } from 'lucide-react'
import { computeGridScale, describeGridScale, formatCellSize } from '@/lib/booth-planner/grid-scale'
import type { LayoutSpacingMode } from '@/lib/booth-planner/table-space'

interface GridScaleBannerProps {
  venueWidthFt: number
  venueLengthFt: number
  boothWidthFt: number
  boothLengthFt: number
  spacingMode?: LayoutSpacingMode
  className?: string
}

export function GridScaleBanner({
  venueWidthFt,
  venueLengthFt,
  boothWidthFt,
  boothLengthFt,
  spacingMode = 'standard',
  className = '',
}: GridScaleBannerProps) {
  const scale =
    spacingMode === 'one_foot'
      ? {
          ...computeGridScale(venueWidthFt, venueLengthFt, 1, 1),
          cellWidthFt: 1,
          cellLengthFt: 1,
          cols: Math.max(1, Math.floor(venueWidthFt)),
          rows: Math.max(1, Math.floor(venueLengthFt)),
          gridWidthFt: Math.max(1, Math.floor(venueWidthFt)),
          gridLengthFt: Math.max(1, Math.floor(venueLengthFt)),
          widthRemainderFt: 0,
          lengthRemainderFt: 0,
        }
      : computeGridScale(venueWidthFt, venueLengthFt, boothWidthFt, boothLengthFt)

  return (
    <aside
      className={`rounded-xl border-2 border-harvest-200 bg-harvest-50/80 px-3 py-2 space-y-1 shadow-[var(--shadow-market)] ${className}`}
      aria-label="Grid scale calibration"
    >
      <div className="flex items-center gap-2 text-xs font-heading font-semibold text-harvest-900">
        <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Grid scale</span>
        <span className="font-sans font-normal text-harvest-800">
          1 cell = {formatCellSize(scale.cellWidthFt, scale.cellLengthFt)}
        </span>
      </div>
      <p className="text-[11px] text-harvest-900/90 leading-snug font-sans">{describeGridScale(scale)}</p>
      <p className="text-[10px] text-muted-foreground">
        Columns run left–right ({scale.cellWidthFt}′ each). Rows run top–bottom ({scale.cellLengthFt}′
        each). Multi-cell booths span that many cells in each direction.
      </p>
    </aside>
  )
}
