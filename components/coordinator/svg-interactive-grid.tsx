'use client'

import { useState, type ReactElement } from 'react'
import type { DragEvent } from 'react'
import type { BoothCell, VenueElement } from '@/types/database'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { SVG_FOOT_PX } from '@/components/coordinator/svg-layout-canvas'
import type { CompositePreviewResult } from '@/lib/booth-planner/layout-engine/composite-preview'
import {
  canRemoveVenueElement,
  fixtureCanvasLabel,
  isElementOrigin,
  isLayoutPresetPaintedElement,
} from '@/lib/booth-planner/venue-elements'
import { isPerimeterWallElement } from '@/lib/booth-planner/perimeter-wall-segments'
import { gridCellTooltip } from '@/lib/booth-planner/layout-tool-shortcuts'
import { formatBoothFootprint } from '@/lib/booth-planner/grid-scale'
import { isFakeVendorId } from '@/lib/booth-planner/fake-vendors'
import { isTentVendor, vendorUnitLabel } from '@/lib/booth-planner/vendor-unit-types'
import { inferTableOrientation } from '@/lib/booth-planner/table-orientation'
import { effectiveStorefrontSide } from '@/lib/booth-planner/facing-target'
import { clientFrontageSide } from '@/lib/booth-planner/grid-glyphs'
import {
  storefrontLabelLineOffsets,
  storefrontLabelTransform,
} from '@/lib/booth-planner/booth-label-layout'
import type { FrontSide } from '@/lib/booth-planner/co-generated-aisles'
import type { LayoutTool } from '@/lib/booth-planner/layout-tool-shortcuts'
import type { DualRingOverlayResult } from '@/lib/booth-planner/clearance-ring-overlay'

const BOOTH_FILLS = ['#E8F0E6', '#F0E8F2', '#FDF3E7', '#E6EEF5', '#F5EDE6', '#EDE8F5']

function boothFill(categoryName: string): string {
  let hash = 0
  for (let i = 0; i < categoryName.length; i++) {
    hash = (hash * 31 + categoryName.charCodeAt(i)) & 0xffffffff
  }
  return BOOTH_FILLS[Math.abs(hash) % BOOTH_FILLS.length]
}

const FIXTURE_FILL: Record<string, string> = {
  entrance: '#DDE8DD',
  exit: '#F5E6E0',
  door: '#FDF0D5',
  aisle: '#FAFAF9',
  restroom: '#E7E5E4',
  food_court: '#FEF3C7',
  seating: '#F5F2EB',
  stage: '#E7E5E4',
  column: '#78716C',
  custom_label: '#FFFFFF',
}

export interface SvgInteractiveGridProps {
  rows: number
  cols: number
  /** Hall interior row count — perimeter walls use this, not extended annex rows. */
  hallRows?: number
  cellPx?: number
  cellMap: Map<string, BoothCell>
  venueMap: Map<string, VenueElement>
  blocked: Set<string>
  bottleneckKeys: Set<string>
  overlapKeys: Set<string>
  showBottleneckOverlay: boolean
  activeTool: LayoutTool
  entrance: 'north' | 'south' | 'east' | 'west'
  isOneFootGrid: boolean
  onCellPointerDown: (row: number, col: number) => void
  onCellPointerEnter: (row: number, col: number) => void
  handleDragStart: (e: DragEvent, col: number, row: number) => void
  handleDrop: (e: DragEvent, col: number, row: number) => void
  onDoorDragStart: (e: DragEvent, doorType: 'entrance' | 'exit') => void
  onVendorPlaceClick: (col: number, row: number) => void
  onUnplaceVendor: (cell: BoothCell) => void
  onSelectPlacedBooth?: (cell: BoothCell) => void
  onRotateTable: (cell: BoothCell) => void
  selectedVendorId?: string | null
  cellWidthFt: number
  cellLengthFt: number
  getCompositeFootprintAt?: (row: number, col: number) => CompositePreviewResult | null
  clearanceOverlay?: DualRingOverlayResult | null
  onVendorHover?: (row: number, col: number) => void
  onDragHover?: (row: number, col: number) => void
  onDragHoverEnd?: () => void
}

export function SvgInteractiveGrid({
  rows,
  cols,
  hallRows = rows,
  cellPx = SVG_FOOT_PX,
  cellMap,
  venueMap,
  blocked,
  bottleneckKeys,
  overlapKeys,
  showBottleneckOverlay,
  activeTool,
  entrance,
  isOneFootGrid,
  onCellPointerDown,
  onCellPointerEnter,
  handleDragStart,
  handleDrop,
  onDoorDragStart,
  onVendorPlaceClick,
  onUnplaceVendor,
  onSelectPlacedBooth,
  onRotateTable,
  selectedVendorId = null,
  cellWidthFt,
  cellLengthFt,
  getCompositeFootprintAt,
  clearanceOverlay = null,
  onVendorHover,
  onDragHover,
  onDragHoverEnd,
}: SvgInteractiveGridProps) {
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number } | null>(null)
  const showFootprintPreview =
    activeTool === 'vendor' && isOneFootGrid && getCompositeFootprintAt != null
  const previewResult =
    showFootprintPreview && hoverCell
      ? getCompositeFootprintAt(hoverCell.r, hoverCell.c)
      : null

  const rendered = new Set<string>()
  const elements: React.ReactElement[] = []
  const previewElements: React.ReactElement[] = []

  if (previewResult) {
    for (const cell of previewResult.cells) {
      previewElements.push(
        renderFootprintPreviewCell(cell, cellPx, !previewResult.valid)
      )
    }
  }

  if (clearanceOverlay) {
    const overlap = clearanceOverlay.hasOverlap
    const seen = new Set<string>()
    for (const ring of clearanceOverlay.activeRings) {
      if (ring.kind !== 'buffer') continue
      const key = `active-${ring.r}-${ring.c}`
      if (seen.has(key)) continue
      seen.add(key)
      previewElements.push(
        renderClearanceRingCell(ring.r, ring.c, cellPx, overlap ? 'active-overlap' : 'active')
      )
    }
    for (const ring of clearanceOverlay.targetRings) {
      if (ring.kind !== 'buffer') continue
      const key = `target-${ring.r}-${ring.c}`
      if (seen.has(key)) continue
      seen.add(key)
      previewElements.push(
        renderClearanceRingCell(ring.r, ring.c, cellPx, overlap ? 'target-overlap' : 'target')
      )
    }
  }

  const px = (col: number) => col * cellPx
  const py = (row: number) => row * cellPx

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}-${c}`
      if (rendered.has(key)) continue

      const booth = cellMap.get(key)
      if (booth && booth.col === c && booth.row === r) {
        for (let dr = 0; dr < booth.rowSpan; dr++) {
          for (let dc = 0; dc < booth.colSpan; dc++) {
            rendered.add(`${r + dr}-${c + dc}`)
          }
        }
        const tableDirection =
          !isTentVendor(booth.vendorUnitType) && isOneFootGrid
            ? booth.tableOrientation ??
              inferTableOrientation(booth.colSpan, booth.rowSpan, booth.tableLengthFt ?? undefined)
            : null
        const storefrontSide = storefrontSideForBooth(
          booth,
          entrance,
          r,
          c,
          hallRows,
          cols,
          isOneFootGrid
        )
        const w = booth.colSpan * cellPx
        const h = booth.rowSpan * cellPx
        const x = px(c)
        const y = py(r)
        const hasOverlap = cellSetOverlap(r, c, booth.rowSpan, booth.colSpan, overlapKeys)
        const hasBottleneck =
          showBottleneckOverlay && cellSetOverlap(r, c, booth.rowSpan, booth.colSpan, bottleneckKeys)
        const isSelected = selectedVendorId === booth.id
        const boothTip = gridCellTooltip({
          booth: {
            vendorName: booth.vendorName,
            boothNumber: booth.boothNumber,
            footprint: formatBoothFootprint(booth.colSpan, booth.rowSpan, cellWidthFt, cellLengthFt),
            unitLabel: vendorUnitLabel(booth.vendorUnitType, booth.tableLengthFt, tableDirection),
          },
        })

        elements.push(
          <g key={`booth-${booth.id}`}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={boothFill(booth.categoryName)}
              stroke={isSelected ? '#166534' : '#000000'}
              strokeWidth={isSelected ? 4 : isFakeVendorId(booth.id) ? 3 : 2}
              rx={4}
            />
            {hasOverlap ? (
              <rect x={x} y={y} width={w} height={h} fill="#DC2626" fillOpacity={0.35} pointerEvents="none" />
            ) : null}
            {hasBottleneck ? (
              <rect x={x} y={y} width={w} height={h} fill="#F59E0B" fillOpacity={0.35} pointerEvents="none" />
            ) : null}
            {renderStorefrontIndicator(x, y, w, h, storefrontSide, cellPx)}
            {renderBoothLabels(
              x,
              y,
              w,
              h,
              storefrontSide,
              booth.vendorName,
              vendorUnitLabel(booth.vendorUnitType, booth.tableLengthFt, tableDirection),
              booth.boothNumber,
              cellPx
            )}
            <foreignObject x={x} y={y} width={w} height={h}>
              <TooltipWrapper text={boothTip}>
                <div
                  draggable={activeTool === 'vendor'}
                  onDragStart={(e) => handleDragStart(e, c, r)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    onDragHover?.(r, c)
                  }}
                  onDrop={(e) => {
                    onDragHoverEnd?.()
                    handleDrop(e, c, r)
                  }}
                  onMouseDown={(e) => {
                    if (activeTool === 'vendor') {
                      e.preventDefault()
                      e.stopPropagation()
                      onVendorPlaceClick(c, r)
                      return
                    }
                    if (activeTool === 'lock') {
                      e.preventDefault()
                      e.stopPropagation()
                      onSelectPlacedBooth?.(booth)
                      return
                    }
                    if (activeTool === 'eraser') {
                      e.preventDefault()
                      e.stopPropagation()
                      onUnplaceVendor(booth)
                    }
                  }}
                  className={`h-full w-full ${
                    activeTool === 'vendor'
                      ? 'cursor-pointer'
                      : activeTool === 'lock'
                        ? 'cursor-pointer'
                        : activeTool === 'eraser'
                          ? 'cursor-pointer'
                          : ''
                  }`}
                />
              </TooltipWrapper>
            </foreignObject>
            {activeTool === 'vendor' && !isTentVendor(booth.vendorUnitType) ? (
              <text
                x={x + 6}
                y={y + 12}
                fontSize={10}
                fontWeight={900}
                fill="#000000"
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  onRotateTable(booth)
                }}
              >
                ↻
              </text>
            ) : null}
          </g>
        )
        continue
      }

      const fixture = venueMap.get(key)
      if (fixture && isElementOrigin(fixture, r, c) && fixture.type === 'stage') {
        const spanC = fixture.colSpan ?? 1
        const spanR = fixture.rowSpan ?? 1
        const w = spanC * cellPx
        const h = spanR * cellPx
        const x = px(c)
        const y = py(r)
        const label = fixtureCanvasLabel(fixture, cols, hallRows)
        const fixtureTip = gridCellTooltip({
          fixture: { label: label || fixture.type, type: fixture.type },
        })
        elements.push(
          <g key={`stage-zone-${fixture.id}`} aria-label={label || 'Stage'} pointerEvents="none">
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke="#78716C"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            {label ? (
              <text
                x={x + w / 2}
                y={y + 14}
                textAnchor="middle"
                fontSize={Math.min(10, cellPx * 0.5)}
                fontWeight={800}
                fill="#57534E"
                pointerEvents="none"
              >
                {truncate(label, 20)}
              </text>
            ) : null}
            <title>{fixtureTip}</title>
          </g>
        )
      } else if (fixture && isElementOrigin(fixture, r, c)) {
        const isPerimeterWall = isPerimeterWallElement(fixture, cols, hallRows)
        const isPresetPaint = isLayoutPresetPaintedElement(fixture, cols, hallRows)
        const isTemplateOnly =
          isPerimeterWall ||
          (fixture.locked &&
            !isPresetPaint &&
            fixture.type !== 'entrance' &&
            fixture.type !== 'exit' &&
            fixture.type !== 'door' &&
            fixture.type !== 'stage')

        if (isTemplateOnly) {
          rendered.add(key)
          continue
        }

        const spanC = fixture.colSpan ?? 1
        const spanR = fixture.rowSpan ?? 1
        for (let dr = 0; dr < spanR; dr++) {
          for (let dc = 0; dc < spanC; dc++) {
            rendered.add(`${r + dr}-${c + dc}`)
          }
        }
        const isMovableDoor =
          (fixture.type === 'entrance' || fixture.type === 'exit') && !fixture.locked
        const w = spanC * cellPx
        const h = spanR * cellPx
        const x = px(c)
        const y = py(r)
        const isWalkway = fixture.type === 'aisle'
        const label = fixtureCanvasLabel(fixture, cols, hallRows)
        const fixtureTip = gridCellTooltip({ fixture: { label: label || fixture.type, type: fixture.type } })
        const removable = canRemoveVenueElement(fixture, { cols, rows: hallRows })

        elements.push(
          <g key={`fixture-${fixture.id}`}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={FIXTURE_FILL[fixture.type] ?? '#E8E4DC'}
              stroke={activeTool === 'eraser' && removable ? '#DC2626' : '#000000'}
              strokeWidth={activeTool === 'eraser' && removable ? 2 : 1.5}
              strokeDasharray={isWalkway || isPresetPaint ? '4 3' : undefined}
              pointerEvents="auto"
            />
            <foreignObject x={x} y={y} width={w} height={h}>
              <TooltipWrapper text={fixtureTip}>
                <div
                  draggable={isMovableDoor}
                  onDragStart={(e) =>
                    isMovableDoor && onDoorDragStart(e, fixture.type as 'entrance' | 'exit')
                  }
                  onMouseDown={(e) => {
                    if (isMovableDoor) {
                      e.preventDefault()
                      return
                    }
                    e.preventDefault()
                    onCellPointerDown(r, c)
                  }}
                  onMouseEnter={() => onCellPointerEnter(r, c)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    onDragHover?.(r, c)
                  }}
                  onDrop={(e) => {
                    onDragHoverEnd?.()
                    handleDrop(e, c, r)
                  }}
                  className={`h-full w-full ${
                    isMovableDoor
                      ? 'cursor-grab'
                      : activeTool === 'eraser' && removable
                        ? 'cursor-pointer'
                        : 'cursor-crosshair'
                  }`}
                />
              </TooltipWrapper>
            </foreignObject>
            {label ? (
              <text
                x={x + w / 2}
                y={y + h / 2 + 3}
                textAnchor="middle"
                fontSize={Math.min(10, cellPx * 0.5)}
                fontWeight={800}
                fill="#000000"
                pointerEvents="none"
              >
                {truncate(label, 16)}
              </text>
            ) : null}
          </g>
        )
        continue
      }

      if (blocked.has(key)) {
        rendered.add(key)
        continue
      }

      elements.push(
        <rect
          key={`cell-${key}`}
          x={px(c)}
          y={py(r)}
          width={cellPx}
          height={cellPx}
          fill="transparent"
          fillOpacity={0}
          stroke="none"
          data-empty="true"
          onDragOver={(e) => {
            e.preventDefault()
            onDragHover?.(r, c)
          }}
          onDrop={(e) => {
            onDragHoverEnd?.()
            handleDrop(e as unknown as DragEvent, c, r)
          }}
          onMouseDown={() => {
            if (activeTool === 'vendor') {
              const preview = getCompositeFootprintAt?.(r, c)
              if (preview && !preview.valid) return
              onVendorPlaceClick(c, r)
              return
            }
            onCellPointerDown(r, c)
          }}
          onMouseEnter={() => {
            onCellPointerEnter(r, c)
            if (showFootprintPreview) {
              setHoverCell({ r, c })
              onVendorHover?.(r, c)
            }
          }}
          onMouseMove={() => {
            if (showFootprintPreview) {
              setHoverCell({ r, c })
              onVendorHover?.(r, c)
            }
          }}
        />
      )
      rendered.add(key)
    }
  }

  return (
    <g
      aria-label="Interactive floor grid"
      onMouseLeave={() => {
        setHoverCell(null)
        onDragHoverEnd?.()
      }}
    >
      {previewElements}
      {elements}
    </g>
  )
}

function renderFootprintPreviewCell(
  cell: CompositePreviewResult['cells'][number],
  cellPx: number,
  invalid: boolean
) {
  const x = cell.c * cellPx
  const y = cell.r * cellPx
  const key = `preview-${cell.r}-${cell.c}`

  if (invalid) {
    return (
      <rect
        key={key}
        x={x}
        y={y}
        width={cellPx}
        height={cellPx}
        fill="rgba(239,68,68,0.4)"
        pointerEvents="none"
      />
    )
  }

  switch (cell.type) {
    case 'booth':
      return (
        <rect
          key={key}
          x={x}
          y={y}
          width={cellPx}
          height={cellPx}
          fill="#fef08a"
          stroke="#000000"
          strokeWidth={2}
          pointerEvents="none"
        />
      )
    case 'buffer':
      return (
        <rect
          key={key}
          x={x}
          y={y}
          width={cellPx}
          height={cellPx}
          fill="#71717a"
          fillOpacity={0.22}
          stroke="#3b82f6"
          strokeWidth={1}
          strokeOpacity={0.35}
          pointerEvents="none"
        />
      )
  }
}

type RingTone = 'active' | 'target' | 'active-overlap' | 'target-overlap'

function renderClearanceRingCell(r: number, c: number, cellPx: number, tone: RingTone) {
  const x = c * cellPx
  const y = r * cellPx
  const overlap = tone.includes('overlap')
  const isActive = tone.startsWith('active')
  const fill = overlap ? '#ef4444' : isActive ? '#fbbf24' : '#60a5fa'
  const stroke = overlap ? '#b91c1c' : isActive ? '#d97706' : '#2563eb'
  return (
    <rect
      key={`ring-${tone}-${r}-${c}`}
      x={x}
      y={y}
      width={cellPx}
      height={cellPx}
      fill={fill}
      fillOpacity={overlap ? 0.42 : 0.28}
      stroke={stroke}
      strokeWidth={overlap ? 2 : 1}
      className={overlap ? 'animate-pulse' : undefined}
      pointerEvents="none"
    />
  )
}

function cellSetOverlap(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  keys: Set<string>
): boolean {
  for (let dr = 0; dr < rowSpan; dr++) {
    for (let dc = 0; dc < colSpan; dc++) {
      if (keys.has(`${row + dr}-${col + dc}`)) return true
    }
  }
  return false
}

function storefrontSideForBooth(
  booth: BoothCell,
  entrance: 'north' | 'south' | 'east' | 'west',
  row: number,
  col: number,
  hallRows: number,
  cols: number,
  isOneFootGrid: boolean
): FrontSide {
  if (isOneFootGrid && !isTentVendor(booth.vendorUnitType)) {
    return effectiveStorefrontSide(booth.facingTarget, entrance, row, col, hallRows, cols)
  }
  return clientFrontageSide(entrance)
}

function renderBoothLabels(
  x: number,
  y: number,
  w: number,
  h: number,
  side: FrontSide,
  vendorName: string,
  unitLabel: string,
  boothNumber: number,
  cellPx: number
): ReactElement {
  const { cx, cy, rotate } = storefrontLabelTransform(side, x, y, w, h, Math.min(8, cellPx * 0.4))
  const { nameDy, unitDy, boothDy } = storefrontLabelLineOffsets()
  const nameSize = Math.min(11, cellPx * 0.55)
  const unitSize = Math.min(9, cellPx * 0.45)

  return (
    <g
      transform={`translate(${cx} ${cy}) rotate(${rotate})`}
      pointerEvents="none"
      aria-hidden
    >
      <text
        y={nameDy}
        textAnchor="middle"
        fontSize={nameSize}
        fontWeight={900}
        fill="#000000"
      >
        {truncate(vendorName, 14)}
      </text>
      <text
        y={unitDy}
        textAnchor="middle"
        fontSize={unitSize}
        fontWeight={700}
        fill="#000000"
      >
        {unitLabel}
      </text>
      <text y={boothDy} textAnchor="middle" fontSize={8} fontWeight={800} fill="#000000">
        #{boothNumber}
      </text>
    </g>
  )
}

function renderStorefrontIndicator(
  x: number,
  y: number,
  w: number,
  h: number,
  side: FrontSide,
  cellPx: number
): React.ReactElement {
  const size = Math.min(8, cellPx * 0.45)
  const cx = x + w / 2
  const cy = y + h / 2
  let points: string
  switch (side) {
    case 'top':
      points = `${cx},${y + 3} ${cx - size},${y + 3 + size} ${cx + size},${y + 3 + size}`
      break
    case 'bottom':
      points = `${cx},${y + h - 3} ${cx - size},${y + h - 3 - size} ${cx + size},${y + h - 3 - size}`
      break
    case 'left':
      points = `${x + 3},${cy} ${x + 3 + size},${cy - size} ${x + 3 + size},${cy + size}`
      break
    case 'right':
      points = `${x + w - 3},${cy} ${x + w - 3 - size},${cy - size} ${x + w - 3 - size},${cy + size}`
      break
  }
  return (
    <polygon
      points={points}
      fill="#1B4332"
      stroke="#FFFFFF"
      strokeWidth={0.75}
      pointerEvents="none"
    />
  )
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}
