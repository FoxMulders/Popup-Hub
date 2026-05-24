'use client'

import { memo, useCallback, type Dispatch, type SetStateAction } from 'react'
import type { BoothCell } from '@/types/database'
import { cn } from '@/lib/utils'

interface FloorplanBoothPinProps {
  cell: BoothCell
  cellPx: number
  highlighted: boolean
  selected: boolean
  onSelect: (boothNumber: number) => void
}

export const FloorplanBoothPin = memo(function FloorplanBoothPin({
  cell,
  cellPx,
  highlighted,
  selected,
  onSelect,
}: FloorplanBoothPinProps) {
  const key = `${cell.row}-${cell.col}`

  return (
    <button
      key={key}
      type="button"
      aria-label={`Booth ${cell.boothNumber}, ${cell.vendorName}`}
      aria-pressed={selected}
      onClick={() => onSelect(cell.boothNumber)}
      className={cn(
        'absolute flex flex-col items-center justify-center overflow-hidden rounded border text-center transition-all touch-manipulation',
        selected
          ? 'z-20 border-forest bg-forest/25 ring-2 ring-forest shadow-md scale-[1.02]'
          : highlighted
            ? 'z-10 border-forest bg-forest/20 ring-2 ring-forest/70'
            : 'z-[1] border-stone-300 bg-white/90 hover:ring-1 hover:ring-stone-400'
      )}
      style={{
        left: cell.col * cellPx,
        top: cell.row * cellPx,
        width: cell.colSpan * cellPx,
        height: cell.rowSpan * cellPx,
        minWidth: Math.max(cell.colSpan * cellPx, 40),
        minHeight: Math.max(cell.rowSpan * cellPx, 40),
        fontSize: Math.max(7, cellPx - 1),
      }}
      title={cell.vendorName}
    >
      <span className="font-bold leading-none">#{cell.boothNumber}</span>
      {cellPx >= 9 ? (
        <span className="line-clamp-2 px-0.5 leading-tight">{cell.vendorName}</span>
      ) : null}
    </button>
  )
})

interface FloorplanFixtureProps {
  id: string
  label: string
  row: number
  col: number
  colSpan: number
  rowSpan: number
  cellPx: number
  focused: boolean
  isStageAnnex: boolean
}

export const FloorplanFixture = memo(function FloorplanFixture({
  id,
  label,
  row,
  col,
  colSpan,
  rowSpan,
  cellPx,
  focused,
  isStageAnnex,
}: FloorplanFixtureProps) {
  return (
    <div
      key={id}
      className={cn(
        'absolute flex items-center justify-center rounded border text-center font-semibold pointer-events-none',
        isStageAnnex
          ? 'border-violet-500 bg-violet-100/90 text-violet-900'
          : focused
            ? 'z-20 border-forest bg-harvest-100 ring-2 ring-forest'
            : 'border-stone-400 bg-stone-100 text-stone-800'
      )}
      style={{
        left: col * cellPx,
        top: row * cellPx,
        width: colSpan * cellPx,
        height: rowSpan * cellPx,
        fontSize: Math.max(7, cellPx - 1),
      }}
    >
      {label}
    </div>
  )
})

export function collectOriginBoothCells(cells: BoothCell[]): BoothCell[] {
  const rendered = new Set<string>()
  const origins: BoothCell[] = []

  for (const cell of cells) {
    if (cell.col < 0 || cell.row < 0) continue
    const key = `${cell.row}-${cell.col}`
    if (rendered.has(key)) continue
    for (let dr = 0; dr < cell.rowSpan; dr++) {
      for (let dc = 0; dc < cell.colSpan; dc++) {
        rendered.add(`${cell.row + dr}-${cell.col + dc}`)
      }
    }
    origins.push(cell)
  }

  return origins
}

export function useStableBoothSelectHandler(
  routeMode: string,
  setSelectedBoothNumber: Dispatch<SetStateAction<number | null>>,
  setShowPatronFlow: Dispatch<SetStateAction<boolean>>
) {
  return useCallback(
    (boothNumber: number) => {
      setSelectedBoothNumber((prev) => (prev === boothNumber ? null : boothNumber))
      if (routeMode === 'vendor') setShowPatronFlow(true)
    },
    [routeMode, setSelectedBoothNumber, setShowPatronFlow]
  )
}
