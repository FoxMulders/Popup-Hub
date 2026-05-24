'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { displayLabel, isElementOrigin } from '@/lib/booth-planner/venue-elements'
import type { PatronPathTrace } from '@/lib/booth-planner/patron-path-trace'
import {
  computeRouteTraceAsync,
  isShopperRouteAvailable,
} from '@/lib/shopper/compute-route-async'
import {
  getLayoutRooms,
  getRoomCanvasMetrics,
  responsiveCellPx,
  type ShopperRouteMode,
} from '@/lib/shopper/layout'
import type { BoothLayout, VenueElementType } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PatronFlowOverlay } from '@/components/shopper/patron-flow-overlay'
import {
  collectOriginBoothCells,
  FloorplanBoothPin,
  FloorplanFixture,
  useStableBoothSelectHandler,
} from '@/components/shopper/floorplan-booth-pin'
import { Map, Route, Search, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

const ESSENTIAL_TYPES: { type: VenueElementType; label: string }[] = [
  { type: 'restroom', label: 'Restrooms' },
  { type: 'food_court', label: 'Food' },
  { type: 'seating', label: 'Seating' },
  { type: 'info_desk', label: 'Info' },
  { type: 'stage', label: 'Stage' },
]

const ROUTE_MODES: { id: ShopperRouteMode; label: string; hint: string }[] = [
  {
    id: 'baseline',
    label: 'Patron flow',
    hint: 'South entrance through aisles to the Raised Stage annex.',
  },
  {
    id: 'vendor',
    label: 'Direct to vendor',
    hint: 'A* shortest walk from entrance to the booth you select.',
  },
  {
    id: 'exposition',
    label: 'Browse all',
    hint: 'Optimized loop visiting every vendor aisle node once (TSP heuristic).',
  },
]

interface PublicFloorplanProps {
  layout: BoothLayout
  highlightBoothNumber?: number | null
}

export function PublicFloorplan({ layout, highlightBoothNumber }: PublicFloorplanProps) {
  const rooms = useMemo(() => getLayoutRooms(layout), [layout])
  const [activeRoomId, setActiveRoomId] = useState(rooms[0]?.id ?? 'main')
  const [search, setSearch] = useState('')
  const [focusElementType, setFocusElementType] = useState<VenueElementType | null>(null)
  const [showPatronFlow, setShowPatronFlow] = useState(false)
  const [routeMode, setRouteMode] = useState<ShopperRouteMode>('baseline')
  const [selectedBoothNumber, setSelectedBoothNumber] = useState<number | null>(
    highlightBoothNumber ?? null
  )
  const [cellPx, setCellPx] = useState(8)
  const [activeTrace, setActiveTrace] = useState<PatronPathTrace | null>(null)
  const [routeComputing, setRouteComputing] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const room = rooms.find((r) => r.id === activeRoomId) ?? rooms[0]
  const searchLower = search.trim().toLowerCase()

  const metrics = useMemo(
    () => (room ? getRoomCanvasMetrics(room) : null),
    [room]
  )

  const selectedBooth = useMemo(() => {
    if (selectedBoothNumber == null || !room) return null
    return (room.cells ?? []).find((c) => c.boothNumber === selectedBoothNumber) ?? null
  }, [room, selectedBoothNumber])

  const deferredRoom = useDeferredValue(room)
  const deferredRouteMode = useDeferredValue(routeMode)
  const deferredSelectedBooth = useDeferredValue(selectedBooth)

  useEffect(() => {
    if (!deferredRoom) {
      setActiveTrace(null)
      setRouteComputing(false)
      return
    }

    let cancelled = false
    setRouteComputing(true)

    void computeRouteTraceAsync(deferredRoom, deferredRouteMode, deferredSelectedBooth).then(
      (trace) => {
        if (!cancelled) {
          setActiveTrace(trace)
          setRouteComputing(false)
        }
      }
    )

    return () => {
      cancelled = true
    }
  }, [deferredRoom, deferredRouteMode, deferredSelectedBooth])

  const routeAvailable = useMemo(() => {
    if (!room) return false
    return isShopperRouteAvailable(room, routeMode, selectedBooth)
  }, [room, routeMode, selectedBooth])

  const hasRoute = activeTrace != null && activeTrace.points.length >= 2
  const routeStale =
    routeComputing ||
    deferredRoom !== room ||
    deferredRouteMode !== routeMode ||
    deferredSelectedBooth !== selectedBooth
  const routeModeMeta = ROUTE_MODES.find((m) => m.id === routeMode) ?? ROUTE_MODES[0]

  const updateCellPx = useCallback(() => {
    if (!metrics || !canvasRef.current) return
    const width = canvasRef.current.clientWidth
    setCellPx(responsiveCellPx(width, metrics.cols, metrics.canvasRows))
  }, [metrics])

  useEffect(() => {
    updateCellPx()
    window.addEventListener('resize', updateCellPx)
    return () => window.removeEventListener('resize', updateCellPx)
  }, [updateCellPx])

  useEffect(() => {
    if (highlightBoothNumber != null) {
      setSelectedBoothNumber(highlightBoothNumber)
    }
  }, [highlightBoothNumber])

  useEffect(() => {
    if (routeMode === 'vendor' && selectedBooth) {
      setShowPatronFlow(true)
    }
  }, [routeMode, selectedBooth])

  const matchingBooths = useMemo(() => {
    if (!room || !searchLower) return new Set<number>()
    const set = new Set<number>()
    for (const cell of room.cells ?? []) {
      if (cell.vendorName?.toLowerCase().includes(searchLower)) {
        set.add(cell.boothNumber)
      }
    }
    return set
  }, [room, searchLower])

  const highlightSet = useMemo(() => {
    const s = new Set<number>()
    if (selectedBoothNumber != null) s.add(selectedBoothNumber)
    matchingBooths.forEach((n) => s.add(n))
    return s
  }, [selectedBoothNumber, matchingBooths])

  const toggleBoothSelection = useStableBoothSelectHandler(
    routeMode,
    setSelectedBoothNumber,
    setShowPatronFlow
  )

  const originBooths = useMemo(
    () => collectOriginBoothCells(room?.cells ?? []),
    [room?.cells]
  )

  const boothElements = useMemo(() => {
    if (!room) return null
    return originBooths.map((cell) => (
      <FloorplanBoothPin
        key={`${cell.row}-${cell.col}`}
        cell={cell}
        cellPx={cellPx}
        highlighted={highlightSet.has(cell.boothNumber)}
        selected={selectedBoothNumber === cell.boothNumber}
        onSelect={toggleBoothSelection}
      />
    ))
  }, [originBooths, cellPx, highlightSet, selectedBoothNumber, toggleBoothSelection, room])

  const fixtureElements = useMemo(() => {
    if (!metrics) return null
    const fixtureRendered = new Set<string>()
    const elements: ReactElement[] = []

    for (const el of metrics.venueElements) {
      if (!isElementOrigin(el, el.row, el.col)) continue
      const key = `${el.row}-${el.col}`
      if (fixtureRendered.has(key)) continue
      fixtureRendered.add(key)
      const focused = focusElementType === el.type
      const isStage = el.type === 'stage' || /raised stage/i.test(el.label ?? '')
      const isAnnex = el.row >= metrics.hallRows
      elements.push(
        <FloorplanFixture
          key={el.id}
          id={el.id}
          label={displayLabel(el)}
          row={el.row}
          col={el.col}
          colSpan={el.colSpan ?? 1}
          rowSpan={el.rowSpan ?? 1}
          cellPx={cellPx}
          focused={focused}
          isStageAnnex={isStage && isAnnex}
        />
      )
    }

    return elements
  }, [metrics, focusElementType, cellPx])

  if (!room || !metrics) {
    return (
      <p className="text-sm text-muted-foreground">Floor plan not available for this market yet.</p>
    )
  }

  const { cols, canvasRows, hallRows, placedCells } = metrics

  const routeHint =
    routeStale && showPatronFlow
      ? 'Calculating route…'
      : routeMode === 'vendor' && !selectedBooth
        ? 'Select a booth on the map to plot the quickest aisle path from the entrance.'
        : routeModeMeta.hint

  return (
    <div className="space-y-3">
      {rooms.length > 1 && (
        <Tabs value={activeRoomId} onValueChange={setActiveRoomId}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            {rooms.map((r) => (
              <TabsTrigger key={r.id} value={r.id} className="min-h-9">
                {r.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Find a vendor on the map…"
          className="min-h-11 pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2 rounded-xl border bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
            <Label htmlFor="show-patron-flow" className="text-sm font-medium cursor-pointer">
              Show patron flow
            </Label>
          </div>
          <Switch
            id="show-patron-flow"
            checked={showPatronFlow}
            onCheckedChange={setShowPatronFlow}
            disabled={!routeAvailable}
            aria-describedby="patron-flow-hint"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Routing mode">
          {ROUTE_MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={routeMode === id}
              onClick={() => {
                setRouteMode(id)
                setShowPatronFlow(true)
              }}
              className={cn(
                'min-h-9 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                routeMode === id
                  ? 'border-forest bg-forest/10 text-forest'
                  : 'border-stone-200 bg-canvas text-muted-foreground hover:bg-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p id="patron-flow-hint" className="text-xs text-muted-foreground leading-snug">
          {showPatronFlow ? routeHint : 'Enable the toggle to preview routing overlays on the map.'}
          {placedCells.length > 0 && routeMode === 'exposition' ? (
            <span className="block mt-0.5 tabular-nums">
              Covers {placedCells.length} vendor{placedCells.length === 1 ? '' : 's'} in one continuous loop.
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ESSENTIAL_TYPES.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => setFocusElementType(focusElementType === type ? null : type)}
          >
            <Badge
              variant={focusElementType === type ? 'default' : 'outline'}
              className="min-h-8 cursor-pointer"
            >
              {label}
            </Badge>
          </button>
        ))}
      </div>

      <div
        ref={canvasRef}
        className="overflow-auto rounded-xl border bg-canvas p-2 touch-pan-x touch-pan-y max-h-[min(70vh,520px)]"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          className="relative mx-auto"
          style={{
            width: cols * cellPx,
            height: canvasRows * cellPx,
            minWidth: 'min(100%, 280px)',
          }}
        >
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, #d6d3d1 1px, transparent 1px), linear-gradient(to bottom, #d6d3d1 1px, transparent 1px)',
              backgroundSize: `${cellPx}px ${cellPx}px`,
            }}
          />
          {hallRows < canvasRows ? (
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-violet-300/80 pointer-events-none"
              style={{ top: hallRows * cellPx }}
              aria-hidden
            />
          ) : null}
          {fixtureElements}
          {boothElements}
          {showPatronFlow && activeTrace && hasRoute && !routeStale ? (
            <PatronFlowOverlay
              trace={activeTrace}
              mode={routeMode}
              cellPx={cellPx}
              canvasRows={canvasRows}
              cols={cols}
              className="absolute inset-0 z-[5] pointer-events-none"
            />
          ) : null}
        </div>
      </div>

      {selectedBooth ? (
        <div className="rounded-xl border border-forest/30 bg-forest/5 px-3 py-2.5 text-sm space-y-1">
          <p className="font-semibold text-forest flex items-center gap-1.5">
            <Store className="h-4 w-4 shrink-0" />
            Booth #{selectedBooth.boothNumber} · {selectedBooth.vendorName}
          </p>
          {showPatronFlow && routeMode === 'vendor' && hasRoute ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Map className="h-3.5 w-3.5 shrink-0" />
              Blue-to-green path is the shortest aisle route from the {room.entrance} entrance.
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Pinch or scroll to explore · Tap a booth to select · Choose a routing mode and toggle patron flow
      </p>
    </div>
  )
}
