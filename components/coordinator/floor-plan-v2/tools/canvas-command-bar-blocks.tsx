'use client'

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ClipboardPaste,
  Combine,
  Copy,
  DoorOpen,
  Expand,
  Hand,
  LayoutGrid,
  Locate,
  Minimize2,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Siren,
  Split,
  Square,
  Tag,
  Trash2,
  Truck,
  Undo2,
  RectangleHorizontal,
  Circle,
  Eye,
  EyeOff,
} from 'lucide-react'
import { LayoutRoomBar } from '@/components/coordinator/layout-room-bar'
import type { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import {
  DEFAULT_TABLE_SIZE,
  isLayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import type { AutoArrangeMode } from '../engine/auto-arrange'
import type { DrawShape, ToolState } from './types'
import { cn } from '@/lib/utils'
import { CommandButton } from './command-button'
import { TableSizePill } from './table-size-pill'
import type { CanvasToolbarBlockId } from './toolbar-order'
import {
  guestRectTableSpec,
  guestRoundTableSpec,
  isGuestTableLengthFt,
  vendorTableSpec,
  type GuestTableLengthFt,
  type TableSizeSpec,
} from '@/lib/booth-planner/table-shape'

type TablePlacementMode = 'vendor' | 'guest-round' | 'guest-rect'

const PATRON_PLACEMENT_TOOLS: Array<{
  mode: Exclude<TablePlacementMode, 'vendor'>
  label: string
  icon: React.ComponentType<{ className?: string }>
  title: string
}> = [
  {
    mode: 'guest-round',
    label: 'Patron round',
    icon: Circle,
    title: 'Draw patron round table — size from Round column',
  },
  {
    mode: 'guest-rect',
    label: 'Patron rect',
    icon: RectangleHorizontal,
    title: 'Draw patron rectangular banquet table — size from Patron column',
  },
]

function toolbarSectionLabel(text: string, tone: 'amber' | 'violet' | 'teal'): React.ReactNode {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200/80 bg-amber-50/90 text-amber-900'
      : tone === 'violet'
        ? 'border-violet-200/80 bg-violet-50/90 text-violet-900'
        : 'border-teal-200/80 bg-teal-50/90 text-teal-900'
  return (
    <span
      className={cn(
        'mr-0.5 inline-flex h-7 shrink-0 items-center rounded-sm border px-1.5 text-[9px] font-heading font-semibold uppercase tracking-wide',
        toneClass
      )}
    >
      {text}
    </span>
  )
}

function AutoArrangeGroup({
  label,
  mode,
  onModeChange,
  onRun,
  canRun,
  runTitle,
  tone,
}: {
  label: string
  mode: AutoArrangeMode
  onModeChange?: (mode: AutoArrangeMode) => void
  onRun?: () => void
  canRun?: boolean
  runTitle: string
  tone: 'amber' | 'violet'
}) {
  if (!onRun) return null
  const activeClass =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-900 hover:bg-amber-100'
      : 'bg-violet-50 text-violet-900 hover:bg-violet-100'
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      {onModeChange ? (
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as AutoArrangeMode)}
          title={`${label} placement mode`}
          aria-label={`${label} mode`}
          className="h-8 rounded-md border border-stone-200 bg-white px-2 text-[11px] font-semibold text-stone-700"
        >
          <option value="grid">Grid</option>
          <option value="staggered">Staggered</option>
          <option value="perimeter-only">Perimeter</option>
        </select>
      ) : null}
      <CommandButton
        onClick={onRun}
        disabled={!canRun}
        title={runTitle}
        label="Auto-Arrange"
        className={activeClass}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </CommandButton>
    </div>
  )
}

const CREATION_SHAPES: Array<{
  id: DrawShape
  label: string
  icon: React.ComponentType<{ className?: string }>
  variant?: 'floor' | 'arch' | 'destructive'
}> = [
  { id: 'label', label: 'Label', icon: Tag, variant: 'floor' },
  { id: 'wall', label: 'Wall', icon: Square, variant: 'arch' },
  { id: 'open_wall', label: 'Open wall', icon: RectangleHorizontal, variant: 'arch' },
  { id: 'door', label: 'Door', icon: DoorOpen, variant: 'arch' },
  { id: 'emergency_exit', label: 'Exit', icon: Siren, variant: 'arch' },
  { id: 'stage', label: 'Stage', icon: Square, variant: 'arch' },
  {
    id: 'food_truck',
    label: 'Food truck',
    icon: Truck,
    variant: 'arch',
  },
]

/**
 * Props for every toolbar block — pass through from `CanvasCommandBar`
 * so each block can call the same handlers you already wire today.
 */
export interface CanvasCommandBarBlockContext {
  toolState: ToolState
  onToolChange: (tool: ToolState['tool']) => void
  onDrawShapeChange: (shape: DrawShape) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onCenterView: () => void
  onAlignVertical: () => void
  onAlignHorizontal: () => void
  selectedCount: number
  onCopy: () => void
  onPaste: () => void
  clipboardHasContents: boolean
  onRotateLeft: () => void
  onRotateRight: () => void
  onRotateRoomLeft?: () => void
  onRotateRoomRight?: () => void
  selectedRoomId?: string | null
  onVendorAutoArrange?: () => void
  canVendorAutoArrange?: boolean
  vendorAutoArrangeMode?: AutoArrangeMode
  onVendorAutoArrangeModeChange?: (mode: AutoArrangeMode) => void
  onPatronAutoArrange?: () => void
  canPatronAutoArrange?: boolean
  patronAutoArrangeMode?: AutoArrangeMode
  onPatronAutoArrangeModeChange?: (mode: AutoArrangeMode) => void
  onJoinRooms?: () => void
  canJoinRooms?: boolean
  joinLabel: string
  joinTitle: string
  onUnjoinRoom?: () => void
  canUnjoinRoom?: boolean
  onClearAll: () => void
  onDeleteSelected: () => void
  tableSizeFt?: TableSizeSpec
  onTableSizeChange?: (selection: TableSizeSpec) => void
  /** Atomically sets placement spec (sync ref) and activates booth draw. */
  onPrepareTableDraw?: (selection: TableSizeSpec) => void
  zoom: number
  onZoomOut: () => void
  onZoomIn: () => void
  onZoomReset: () => void
  rooms?: LayoutRoom[]
  activeRoomId?: string
  onSelectRoom?: (roomId: string) => void
  onAddRoom?: (options?: import('@/lib/coordinator/add-layout-room').AddLayoutRoomOptions) => void
  onRenameRoom?: (roomId: string, name: string) => void
  onDeleteRoom?: (roomId: string) => void
  highlightedRoomMetrics?: {
    name: string
    widthFt: number
    lengthFt: number
  } | null
  /** W×H label for the single selected canvas object (booth/table). */
  highlightedSelectionMetrics?: string | null
  showLabels?: boolean
  onShowLabelsChange?: (show: boolean) => void
  canvasFullscreen?: boolean
  onToggleCanvasFullscreen?: () => void
  onSaveMarket?: () => void
  saveMarketDisabled?: boolean
  saveMarketLoading?: boolean
}

export function renderCanvasCommandBarBlock(
  id: CanvasToolbarBlockId,
  ctx: CanvasCommandBarBlockContext
): React.ReactNode {
  const hasSelection = ctx.selectedCount > 0
  const canAlign = ctx.selectedCount >= 2
  const rotateRoomId = ctx.selectedRoomId ?? ctx.activeRoomId ?? null
  const canRotateRoom = Boolean(rotateRoomId) && Boolean(ctx.onRotateRoomLeft)
  const rotateRoomHint = rotateRoomId
    ? 'Rotate the room and everything inside it 90°'
    : 'Select a room on the canvas (click its perimeter) to rotate'

  function activateDrawShape(shape: DrawShape) {
    ctx.onToolChange('draw')
    ctx.onDrawShapeChange(shape)
  }

  function resolveGuestTableFt(
    spec: TableSizeSpec | undefined,
    shape: 'round' | 'rectangular'
  ): GuestTableLengthFt {
    if (
      spec?.purpose === 'guest' &&
      spec.shape === shape &&
      isGuestTableLengthFt(spec.ft)
    ) {
      return spec.ft
    }
    return 6
  }

  function isTablePlacementActive(mode: TablePlacementMode): boolean {
    if (ctx.toolState.tool !== 'draw' || ctx.toolState.drawShape !== 'booth') {
      return false
    }
    const spec = ctx.tableSizeFt
    switch (mode) {
      case 'vendor':
        return spec?.purpose !== 'guest'
      case 'guest-round':
        return spec?.purpose === 'guest' && spec.shape === 'round'
      case 'guest-rect':
        return spec?.purpose === 'guest' && spec.shape === 'rectangular'
    }
  }

  function tableSpecForPlacementMode(mode: TablePlacementMode): TableSizeSpec {
    switch (mode) {
      case 'vendor': {
        const ft =
          ctx.tableSizeFt?.purpose === 'vendor' &&
          isLayoutBaselineTableLengthFt(ctx.tableSizeFt.ft)
            ? ctx.tableSizeFt.ft
            : DEFAULT_TABLE_SIZE
        return vendorTableSpec(ft)
      }
      case 'guest-round':
        return guestRoundTableSpec(resolveGuestTableFt(ctx.tableSizeFt, 'round'))
      case 'guest-rect':
        return guestRectTableSpec(
          resolveGuestTableFt(ctx.tableSizeFt, 'rectangular')
        )
    }
  }

  function activateTablePlacement(mode: TablePlacementMode) {
    const spec = tableSpecForPlacementMode(mode)
    if (ctx.onPrepareTableDraw) {
      ctx.onPrepareTableDraw(spec)
      return
    }
    ctx.onTableSizeChange?.(spec)
    activateDrawShape('booth')
  }

  switch (id) {
    case 'primitives':
      return (
        <>
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="Navigation tools"
          >
            <CommandButton
              onClick={() => ctx.onToolChange('select')}
              title="Select (V)"
              active={ctx.toolState.tool === 'select'}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={() => ctx.onToolChange('hand')}
              title="Hand (H)"
              active={ctx.toolState.tool === 'hand'}
            >
              <Hand className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
          <div
            className="mx-0.5 h-6 w-px bg-stone-200"
            aria-hidden
          />
          <div
            className="flex flex-wrap items-center gap-0.5"
            role="group"
            aria-label="Creation tools"
          >
            {CREATION_SHAPES.map((shape) => (
              <CommandButton
                key={shape.id}
                onClick={() => activateDrawShape(shape.id)}
                title={shape.label}
                label={shape.label}
                active={
                  ctx.toolState.tool === 'draw' &&
                  ctx.toolState.drawShape === shape.id
                }
                className={
                  shape.variant === 'floor'
                    ? ctx.toolState.tool === 'draw' &&
                      ctx.toolState.drawShape === shape.id
                      ? 'bg-amber-200 text-amber-950 hover:bg-amber-200'
                      : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100'
                    : shape.variant === 'arch'
                      ? ctx.toolState.tool === 'draw' &&
                        ctx.toolState.drawShape === shape.id
                        ? 'bg-sky-200 text-sky-950 hover:bg-sky-200'
                        : 'text-stone-700 hover:bg-sky-50'
                      : undefined
                }
              >
                <shape.icon className="h-3.5 w-3.5" />
              </CommandButton>
            ))}
            <CommandButton
              onClick={ctx.onDeleteSelected}
              disabled={!hasSelection}
              title={`Delete ${ctx.selectedCount} selected`}
              label="Delete"
              className="text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onClearAll}
              title="Hard reset — clear all rooms and objects"
              label="Clear all"
              className="text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        </>
      )

    case 'history-clipboard':
      return (
        <>
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="History"
          >
            <CommandButton
              onClick={ctx.onUndo}
              disabled={!ctx.canUndo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onRedo}
              disabled={!ctx.canRedo}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
          <div className="mx-0.5 h-6 w-px bg-stone-200" aria-hidden />
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="Selection edit"
          >
            <CommandButton
              onClick={ctx.onCopy}
              disabled={!hasSelection}
              title="Copy selection (Ctrl+C)"
              label="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onPaste}
              disabled={!ctx.clipboardHasContents}
              title="Paste (Ctrl+V)"
              label="Paste"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onRotateLeft}
              disabled={!hasSelection}
              title="Rotate -15°"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onRotateRight}
              disabled={!hasSelection}
              title="Rotate selection +15°"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        </>
      )

    case 'vendor':
      return (
        <>
          {toolbarSectionLabel('Vendor', 'amber')}
          <CommandButton
            onClick={() => activateTablePlacement('vendor')}
            title="Draw vendor booth — size from Booth column"
            label="Booth"
            active={isTablePlacementActive('vendor')}
            className={
              isTablePlacementActive('vendor')
                ? 'bg-amber-200 text-amber-950 hover:bg-amber-200'
                : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100'
            }
          >
            <Square className="h-3.5 w-3.5" />
          </CommandButton>
          {ctx.onTableSizeChange && ctx.tableSizeFt != null ? (
            <>
              <div className="mx-0.5 h-6 w-px bg-stone-200" aria-hidden />
              <TableSizePill
                value={ctx.tableSizeFt}
                onChange={ctx.onTableSizeChange}
                sections="vendor"
                className="shrink-0"
              />
              {ctx.highlightedSelectionMetrics &&
              ctx.tableSizeFt.purpose !== 'guest' ? (
                <span
                  className="hidden shrink-0 rounded-md border border-amber-200/90 bg-amber-50/80 px-2 py-1 text-[10px] font-semibold tabular-nums text-amber-900 sm:inline"
                  aria-live="polite"
                >
                  {ctx.highlightedSelectionMetrics}
                </span>
              ) : null}
            </>
          ) : null}
          {ctx.onVendorAutoArrange ? (
            <>
              <div className="mx-0.5 h-6 w-px bg-stone-200" aria-hidden />
              <AutoArrangeGroup
                label="Vendor auto-arrange"
                mode={ctx.vendorAutoArrangeMode ?? 'grid'}
                onModeChange={ctx.onVendorAutoArrangeModeChange}
                onRun={ctx.onVendorAutoArrange}
                canRun={ctx.canVendorAutoArrange}
                runTitle="Auto-arrange vendor booths in the active room"
                tone="amber"
              />
            </>
          ) : null}
        </>
      )

    case 'patron':
      return (
        <>
          {toolbarSectionLabel('Patron', 'violet')}
          <div
            className="inline-flex items-center gap-0.5"
            role="group"
            aria-label="Patron table tools"
          >
            {PATRON_PLACEMENT_TOOLS.map((tool) => {
              const active = isTablePlacementActive(tool.mode)
              return (
                <CommandButton
                  key={tool.mode}
                  onClick={() => activateTablePlacement(tool.mode)}
                  title={tool.title}
                  label={tool.label}
                  active={active}
                  className={
                    active
                      ? 'bg-violet-200 text-violet-950 hover:bg-violet-200'
                      : 'bg-violet-50/80 text-violet-900 hover:bg-violet-100'
                  }
                >
                  <tool.icon className="h-3.5 w-3.5" />
                </CommandButton>
              )
            })}
          </div>
          {ctx.onTableSizeChange && ctx.tableSizeFt != null ? (
            <>
              <div className="mx-0.5 h-6 w-px bg-stone-200" aria-hidden />
              <TableSizePill
                value={ctx.tableSizeFt}
                onChange={ctx.onTableSizeChange}
                sections="patron"
                className="shrink-0"
              />
              {ctx.highlightedSelectionMetrics &&
              ctx.tableSizeFt.purpose === 'guest' ? (
                <span
                  className="hidden shrink-0 rounded-md border border-violet-200/90 bg-violet-50/80 px-2 py-1 text-[10px] font-semibold tabular-nums text-violet-900 sm:inline"
                  aria-live="polite"
                >
                  {ctx.highlightedSelectionMetrics}
                </span>
              ) : null}
            </>
          ) : null}
          {ctx.onPatronAutoArrange ? (
            <>
              <div className="mx-0.5 h-6 w-px bg-stone-200" aria-hidden />
              <AutoArrangeGroup
                label="Patron auto-arrange"
                mode={ctx.patronAutoArrangeMode ?? 'grid'}
                onModeChange={ctx.onPatronAutoArrangeModeChange}
                onRun={ctx.onPatronAutoArrange}
                canRun={ctx.canPatronAutoArrange}
                runTitle="Auto-arrange patron tables in the active room (vendor booths stay put)"
                tone="violet"
              />
            </>
          ) : null}
        </>
      )

    case 'room':
      return (
        <>
          {toolbarSectionLabel('Room', 'teal')}
          {ctx.onSelectRoom &&
          ctx.onAddRoom &&
          ctx.onRenameRoom &&
          ctx.onDeleteRoom ? (
            <LayoutRoomBar
              rooms={ctx.rooms ?? []}
              activeRoomId={ctx.activeRoomId ?? ctx.rooms?.[0]?.id ?? ''}
              onSelectRoom={ctx.onSelectRoom}
              onAddRoom={ctx.onAddRoom}
              onRenameRoom={ctx.onRenameRoom}
              onDeleteRoom={ctx.onDeleteRoom}
              highlightedRoomMetrics={ctx.highlightedRoomMetrics}
              embedded
            />
          ) : null}
          {ctx.onRotateRoomLeft && ctx.onRotateRoomRight ? (
            <>
              {(ctx.onSelectRoom && ctx.onAddRoom) ||
              ctx.onJoinRooms ||
              ctx.onUnjoinRoom ? (
                <div className="mx-0.5 h-6 w-px bg-stone-200" aria-hidden />
              ) : null}
              <div
                className="inline-flex items-center gap-0.5"
                role="group"
                aria-label="Rotate room"
              >
                <CommandButton
                  onClick={ctx.onRotateRoomLeft}
                  disabled={!canRotateRoom}
                  title={canRotateRoom ? `${rotateRoomHint} (left)` : rotateRoomHint}
                  label="Room ↺"
                  className="text-teal-900 hover:bg-teal-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </CommandButton>
                <CommandButton
                  onClick={ctx.onRotateRoomRight}
                  disabled={!canRotateRoom}
                  title={canRotateRoom ? `${rotateRoomHint} (right)` : rotateRoomHint}
                  label="Room ↻"
                  className="text-teal-900 hover:bg-teal-100"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </CommandButton>
              </div>
            </>
          ) : null}
          {ctx.onJoinRooms || ctx.onUnjoinRoom ? (
            <>
              <div className="mx-0.5 h-6 w-px bg-stone-200" aria-hidden />
              <div
                className="flex items-center gap-0.5"
                role="group"
                aria-label="Room joining"
              >
                {ctx.onJoinRooms ? (
                  <CommandButton
                    onClick={ctx.onJoinRooms}
                    disabled={!ctx.canJoinRooms}
                    title={ctx.joinTitle}
                    label={ctx.joinLabel}
                    className="bg-sky-50 text-sky-900 hover:bg-sky-100"
                  >
                    <Combine className="h-3.5 w-3.5" />
                  </CommandButton>
                ) : null}
                {ctx.onUnjoinRoom ? (
                  <CommandButton
                    onClick={ctx.onUnjoinRoom}
                    disabled={!ctx.canUnjoinRoom}
                    title="Split the active room out of its joined zone"
                    label="Unjoin"
                  >
                    <Split className="h-3.5 w-3.5" />
                  </CommandButton>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      )

    case 'view-align':
      return (
        <>
          <CommandButton
            onClick={ctx.onCenterView}
            title="Center view on all placed objects"
            label="Center"
          >
            <Locate className="h-3.5 w-3.5" />
          </CommandButton>
          <div className="mx-0.5 h-6 w-px bg-stone-200" aria-hidden />
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="Alignment"
          >
            <CommandButton
              onClick={ctx.onAlignVertical}
              disabled={!canAlign}
              title="Align vertical centers (Shift+V)"
            >
              <AlignCenterVertical className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onAlignHorizontal}
              disabled={!canAlign}
              title="Align horizontal centers (Shift+H)"
            >
              <AlignCenterHorizontal className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        </>
      )

    case 'utilities':
      return (
        <>
          {ctx.onShowLabelsChange ? (
            <CommandButton
              onClick={() => ctx.onShowLabelsChange!(!ctx.showLabels)}
              title={
                ctx.showLabels
                  ? 'Hide architectural labels'
                  : 'Show architectural labels'
              }
              label="Show Labels"
              className={
                ctx.showLabels ? 'bg-sky-50 text-sky-900 hover:bg-sky-100' : undefined
              }
            >
              {ctx.showLabels ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </CommandButton>
          ) : null}
          {ctx.onToggleCanvasFullscreen ? (
            <CommandButton
              onClick={() => {
                ctx.onToggleCanvasFullscreen?.()
              }}
              title={
                ctx.canvasFullscreen
                  ? 'Exit full screen (Esc)'
                  : 'Full screen editor'
              }
              label={ctx.canvasFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              className={
                ctx.canvasFullscreen
                  ? 'bg-stone-800 text-white hover:bg-stone-700'
                  : undefined
              }
            >
              {ctx.canvasFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Expand className="h-3.5 w-3.5" />
              )}
            </CommandButton>
          ) : null}
          <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-stone-200">
            <button
              type="button"
              onClick={ctx.onZoomOut}
              title="Zoom out"
              aria-label="Zoom out"
              className="inline-flex h-full w-7 items-center justify-center text-stone-600 hover:bg-stone-100"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={ctx.onZoomReset}
              title="Reset zoom to 100%"
              aria-label="Reset zoom"
              className="inline-flex h-full min-w-[3rem] items-center justify-center border-x border-stone-200 px-1.5 text-[11px] font-semibold tabular-nums text-stone-700 hover:bg-stone-100"
            >
              {Math.round(ctx.zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={ctx.onZoomIn}
              title="Zoom in"
              aria-label="Zoom in"
              className="inline-flex h-full w-7 items-center justify-center text-stone-600 hover:bg-stone-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {ctx.onSaveMarket ? (
            <button
              type="button"
              onClick={ctx.onSaveMarket}
              disabled={ctx.saveMarketDisabled || ctx.saveMarketLoading}
              title="Save market and deploy"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-stone-900 px-3 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {ctx.saveMarketLoading ? 'Saving…' : 'Save market'}
            </button>
          ) : null}
        </>
      )

    default:
      return null
  }
}

export function getVisibleToolbarBlockIds(ctx: {
  needsRoomFirst: boolean
  showVendor: boolean
  showPatron: boolean
  showRoom: boolean
}): CanvasToolbarBlockId[] {
  if (ctx.needsRoomFirst && ctx.showRoom) {
    return ['room']
  }
  const ids: CanvasToolbarBlockId[] = [
    'primitives',
    'history-clipboard',
    'view-align',
  ]
  if (ctx.showVendor) ids.push('vendor')
  if (ctx.showPatron) ids.push('patron')
  if (ctx.showRoom) ids.push('room')
  ids.push('utilities')
  return ids
}
