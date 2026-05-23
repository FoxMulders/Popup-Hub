'use client'

import { useMemo } from 'react'
import { resolveGridConfig } from '@/lib/booth-planner/grid-config'
import { buildVenueElementMap, displayLabel, isElementOrigin } from '@/lib/booth-planner/venue-elements'
import { resolveVenueElementsForCanvas } from '@/lib/booth-planner/resolve-venue-elements'
import type { BoothLayout, BoothCell } from '@/types/database'

const CELL_PX = 10

interface PrintFloorplanProps {
  layout: BoothLayout
  eventName: string
  roomName?: string
}

export function PrintFloorplan({ layout, eventName, roomName }: PrintFloorplanProps) {
  const {
    venue_width,
    venue_length,
    booth_width,
    booth_length,
    entrance,
    cells,
    venue_elements,
    spacing_mode,
  } = layout

  const gridConfig = useMemo(
    () =>
      resolveGridConfig({
        venueWidthFt: venue_width,
        venueLengthFt: venue_length,
        boothWidthFt: booth_width,
        boothLengthFt: booth_length,
        spacingMode: spacing_mode ?? 'one_foot',
      }),
    [venue_width, venue_length, booth_width, booth_length, spacing_mode]
  )

  const cols = gridConfig.cols
  const rows = gridConfig.rows

  const venueElements = useMemo(
    () =>
      resolveVenueElementsForCanvas(venue_elements ?? [], entrance, cols, rows),
    [venue_elements, entrance, cols, rows]
  )

  const venueMap = useMemo(() => buildVenueElementMap(venueElements), [venueElements])

  const cellMap = useMemo(() => {
    const map = new Map<string, BoothCell>()
    for (const cell of cells ?? []) {
      if (cell.col >= 0 && cell.row >= 0) {
        for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
          for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
            map.set(`${r}-${c}`, cell)
          }
        }
      }
    }
    return map
  }, [cells])

  const placedElements = useMemo(() => {
    const out: React.ReactElement[] = []
    const rendered = new Set<string>()

    for (const cell of cells ?? []) {
      if (cell.col < 0 || cell.row < 0) continue
      const key = `${cell.row}-${cell.col}`
      if (rendered.has(key)) continue
      for (let dr = 0; dr < cell.rowSpan; dr++) {
        for (let dc = 0; dc < cell.colSpan; dc++) {
          rendered.add(`${cell.row + dr}-${cell.col + dc}`)
        }
      }
      out.push(
        <div
          key={`b-${cell.id}`}
          style={{
            left: cell.col * CELL_PX,
            top: cell.row * CELL_PX,
            width: cell.colSpan * CELL_PX,
            height: cell.rowSpan * CELL_PX,
          }}
          className="absolute flex flex-col items-center justify-center border-2 border-black bg-white p-0.5 overflow-hidden"
        >
          <span className="text-[7px] font-bold leading-none text-black">#{cell.boothNumber}</span>
          <span className="text-[6px] leading-tight text-center truncate w-full px-0.5 text-black">
            {cell.vendorName}
          </span>
          <span className="text-[5px] leading-tight text-center truncate w-full px-0.5 text-black uppercase">
            {cell.categoryName}
          </span>
        </div>
      )
    }

    for (const fixture of venueElements) {
      const r = fixture.row
      const c = fixture.col
      const key = `${r}-${c}`
      if (!isElementOrigin(fixture, r, c) || rendered.has(key)) continue
      const spanC = fixture.colSpan ?? 1
      const spanR = fixture.rowSpan ?? 1
      for (let dr = 0; dr < spanR; dr++) {
        for (let dc = 0; dc < spanC; dc++) {
          rendered.add(`${r + dr}-${c + dc}`)
        }
      }
      const isAisle = fixture.type === 'aisle'
      const isStructural =
        fixture.type === 'column' ||
        fixture.type === 'entrance' ||
        fixture.type === 'exit' ||
        fixture.type === 'door'
      out.push(
        <div
          key={`f-${fixture.id}`}
          style={{
            left: c * CELL_PX,
            top: r * CELL_PX,
            width: spanC * CELL_PX,
            height: spanR * CELL_PX,
          }}
          className={
            isAisle
              ? 'absolute border border-black bg-[repeating-linear-gradient(45deg,#000_0,#000_1px,transparent_1px,transparent_4px)]'
              : isStructural
                ? 'absolute border-2 border-black bg-white'
                : 'absolute border-2 border-black bg-white flex items-center justify-center'
          }
        >
          {!isAisle && !isStructural ? (
            <span className="text-[6px] font-bold uppercase text-black">{displayLabel(fixture)}</span>
          ) : null}
        </div>
      )
    }

    return out
  }, [cells, venueElements])

  return (
    <div className="print-floorplan">
      <header className="mb-4 border-b-2 border-black pb-3">
        <h1 className="font-heading text-2xl font-bold text-black">{eventName}</h1>
        {roomName ? (
          <p className="text-sm font-semibold text-black mt-1">{roomName}</p>
        ) : null}
        <p className="text-xs text-black mt-2">
          {venue_width}′ × {venue_length}′ · {cols} × {rows} grid (1 cell = 1′) · Entrance:{' '}
          {entrance} · Printed {new Date().toLocaleString()}
        </p>
      </header>
      <div
        className="relative mx-auto border-2 border-black bg-white"
        style={{
          width: `${cols * CELL_PX + 4}px`,
          height: `${rows * CELL_PX + 4}px`,
        }}
      >
        {placedElements}
      </div>
      <footer className="mt-4 flex flex-wrap gap-4 text-[10px] text-black">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 border-2 border-black bg-white" /> Vendor booth
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 border border-black bg-[repeating-linear-gradient(45deg,#000_0,#000_1px,transparent_1px,transparent_3px)]" />{' '}
          Aisle
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 border-2 border-black bg-white" /> Structural
        </span>
      </footer>
    </div>
  )
}
