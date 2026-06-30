'use client'

import { useMemo, useCallback } from 'react'
import { Download, Eye } from 'lucide-react'
import type { BoothCell, VenueElement } from '@/types/database'
import {
  buildPureLayoutSvg,
  collectPureLayoutAssets,
  downloadSvg,
  pureLayoutBounds,
  svgToDataUrl,
} from '@/lib/booth-planner/pure-layout-export'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'

const PREVIEW_CELL_PX = 4

interface PureLayoutPreviewProps {
  cells: BoothCell[]
  venueElements: VenueElement[]
  roomName: string
}

export function PureLayoutPreview({ cells, venueElements, roomName }: PureLayoutPreviewProps) {
  const assets = useMemo(
    () => collectPureLayoutAssets(cells, venueElements),
    [cells, venueElements]
  )

  const bounds = useMemo(() => pureLayoutBounds(assets), [assets])

  const svg = useMemo(
    () => buildPureLayoutSvg(assets, { cellPx: PREVIEW_CELL_PX, title: roomName }),
    [assets, roomName]
  )

  const dataUrl = useMemo(() => svgToDataUrl(svg), [svg])

  const handleQuickExport = useCallback(() => {
    if (assets.length === 0) {
      toast.message('Nothing to export — place booths or fixtures first')
      return
    }
    downloadSvg(svg, `${roomName.replace(/\s+/g, '-').toLowerCase()}-layout.svg`)
    toast.success('Pure layout exported as SVG')
  }, [assets.length, svg, roomName])

  return (
    <aside
      className="market-panel p-3 space-y-2 w-full lg:w-56 shrink-0"
      aria-label="Pure layout preview"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Eye className="h-4 w-4 text-forest shrink-0" aria-hidden />
          <p className="text-xs font-heading font-semibold text-foreground truncate">
            Pure Layout
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="min-h-11 min-w-11 shrink-0"
          title="Quick Export Preview — download isolated SVG"
          aria-label="Quick Export Preview"
          onClick={handleQuickExport}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Live overview — physical assets only. No gridlines or empty cells.
      </p>

      <div
        className="relative overflow-hidden rounded-lg border-2 border-stone-200 bg-canvas mx-auto"
        style={{
          width: Math.min(bounds.cols * PREVIEW_CELL_PX + 4, 220),
          height: Math.min(bounds.rows * PREVIEW_CELL_PX + 4, 180),
        }}
      >
        {assets.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground px-2 text-center">
            Empty canvas
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`Pure layout preview of ${roomName}`}
            className="w-full h-full object-contain"
          />
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
        <dt className="text-muted-foreground">Assets</dt>
        <dd className="font-medium tabular-nums text-right">{assets.length}</dd>
        <dt className="text-muted-foreground">Footprint</dt>
        <dd className="font-medium tabular-nums text-right">
          {bounds.cols}′ × {bounds.rows}′
        </dd>
      </dl>
    </aside>
  )
}
