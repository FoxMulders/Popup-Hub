'use client'

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
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
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { cn } from '@/lib/utils'
import {
  CommandButton,
  toolbarControlHeight,
  toolbarDividerClass,
  toolbarIconButtonSize,
} from './command-button'
import {
  TableSizePill,
  PatronTableSizeRows,
  PatronSidebarControls,
  VendorSidebarSizeGrid,
} from './table-size-pill'
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

function AutoArrangeGroup({
  label,
  mode,
  onModeChange,
  onRun,
  canRun,
  runTitle,
  tone,
  compact,
}: {
  label: string
  mode: AutoArrangeMode
  onModeChange?: (mode: AutoArrangeMode) => void
  onRun?: () => void
  canRun?: boolean
  runTitle: string
  tone: 'amber' | 'violet'
  compact?: boolean
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
          className={cn(
            'rounded-md border border-stone-200 bg-white px-2 text-[11px] font-semibold text-stone-700',
            toolbarControlHeight(compact ?? false)
          )}
        >
          <option value="grid">Grid</option>
          <option value="staggered">Staggered</option>
          <option value="perimeter-only">Perimeter</option>
        </select>
      ) : null}
      <CommandButton
        onClick={onRun}
        disabled={!canRun}
        title={`Auto-arrange — ${runTitle}`}
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
  onDistributeVertical: () => void
  onDistributeHorizontal: () => void
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
  /** Static dashboard ribbon — tighter control heights (~10% shorter). */
  compact?: boolean
  /** Left-rail layout designer sidebar — stacked columns and split headers. */
  sidebarLayout?: boolean
}

export function renderCanvasCommandBarBlock(
  id: CanvasToolbarBlockId,
  ctx: CanvasCommandBarBlockContext
): React.ReactNode {
  const hasSelection = ctx.selectedCount > 0
  const canAlign = ctx.selectedCount >= 2
  const canDistribute = ctx.selectedCount >= 3
  const compact = ctx.compact ?? false
  const sidebarLayout = ctx.sidebarLayout ?? false
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
    activateTableSize(tableSpecForPlacementMode(mode))
  }

  function activateTableSize(spec: TableSizeSpec) {
    if (ctx.onPrepareTableDraw) {
      ctx.onPrepareTableDraw(spec)
      return
    }
    ctx.onTableSizeChange?.(spec)
    activateDrawShape('booth')
  }

  switch (id) {
    case 'primitives':
      if (sidebarLayout) {
        return (
          <div
            className="flex w-full min-w-0 flex-wrap content-start gap-0.5"
            role="group"
            aria-label="Designer tools"
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
            {CREATION_SHAPES.map((shape) => (
              <CommandButton
                key={shape.id}
                onClick={() => activateDrawShape(shape.id)}
                title={shape.label}
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
              className="text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        )
      }
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
            className={toolbarDividerClass(compact)}
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
              className="text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onClearAll}
              title="Clear all — hard reset rooms and objects"
              className="text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        </>
      )

    case 'history-clipboard':
      if (sidebarLayout) {
        return (
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
        )
      }
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
          <div className={toolbarDividerClass(compact)} aria-hidden />
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="Selection edit"
          >
            <CommandButton
              onClick={ctx.onCopy}
              disabled={!hasSelection}
              title="Copy selection (Ctrl+C)"
            >
              <Copy className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onPaste}
              disabled={!ctx.clipboardHasContents}
              title="Paste (Ctrl+V)"
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
      if (sidebarLayout) {
        return (
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            <CommandButton
              onClick={() => activateTablePlacement('vendor')}
              title="Draw vendor — size from Vendor column"
              active={isTablePlacementActive('vendor')}
              className={cn(
                'self-start',
                isTablePlacementActive('vendor')
                  ? 'bg-amber-200 text-amber-950 hover:bg-amber-200'
                  : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100'
              )}
            >
              <Square className="h-3.5 w-3.5" />
            </CommandButton>
            {ctx.onTableSizeChange && ctx.tableSizeFt != null ? (
              <VendorSidebarSizeGrid
                value={ctx.tableSizeFt}
                onChange={activateTableSize}
                compact={compact}
              />
            ) : null}
            {ctx.onVendorAutoArrange ? (
              <AutoArrangeGroup
                label="Vendor auto-arrange"
                mode={ctx.vendorAutoArrangeMode ?? 'grid'}
                onModeChange={ctx.onVendorAutoArrangeModeChange}
                onRun={ctx.onVendorAutoArrange}
                canRun={ctx.canVendorAutoArrange}
                runTitle="Auto-arrange vendor in the active room"
                tone="amber"
                compact={compact}
              />
            ) : null}
          </div>
        )
      }
      return (
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-0.5">
          <CommandButton
            onClick={() => activateTablePlacement('vendor')}
            title="Draw vendor — size from Vendor column"
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
              <div className={toolbarDividerClass(compact)} aria-hidden />
              <TableSizePill
                value={ctx.tableSizeFt}
                onChange={activateTableSize}
                sections="vendor"
                compact={compact}
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
              <div className={toolbarDividerClass(compact)} aria-hidden />
              <AutoArrangeGroup
                label="Vendor auto-arrange"
                mode={ctx.vendorAutoArrangeMode ?? 'grid'}
                onModeChange={ctx.onVendorAutoArrangeModeChange}
                onRun={ctx.onVendorAutoArrange}
                canRun={ctx.canVendorAutoArrange}
                runTitle="Auto-arrange vendor in the active room"
                tone="amber"
                compact={compact}
              />
            </>
          ) : null}
        </div>
      )

    case 'patron':
      if (sidebarLayout) {
        return (
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            {ctx.onTableSizeChange && ctx.tableSizeFt != null ? (
              <PatronSidebarControls
                value={ctx.tableSizeFt}
                onSelectSize={activateTableSize}
                onRoundToolClick={() =>
                  activateTableSize(
                    guestRoundTableSpec(resolveGuestTableFt(ctx.tableSizeFt, 'round'))
                  )
                }
                onRectToolClick={() =>
                  activateTableSize(
                    guestRectTableSpec(
                      resolveGuestTableFt(ctx.tableSizeFt, 'rectangular')
                    )
                  )
                }
                roundToolActive={isTablePlacementActive('guest-round')}
                rectToolActive={isTablePlacementActive('guest-rect')}
                compact={compact}
              />
            ) : null}
            {ctx.onPatronAutoArrange ? (
              <AutoArrangeGroup
                label="Patron auto-arrange"
                mode={ctx.patronAutoArrangeMode ?? 'grid'}
                onModeChange={ctx.onPatronAutoArrangeModeChange}
                onRun={ctx.onPatronAutoArrange}
                canRun={ctx.canPatronAutoArrange}
                runTitle="Auto-arrange patron in the active room (vendor stays put)"
                tone="violet"
                compact={compact}
              />
            ) : null}
          </div>
        )
      }
      return (
        <div className="flex min-w-0 flex-wrap items-center gap-0.5">
          {ctx.onTableSizeChange && ctx.tableSizeFt != null ? (
            <PatronTableSizeRows
              value={ctx.tableSizeFt}
              onSelectSize={activateTableSize}
              onRoundToolClick={() =>
                activateTableSize(
                  guestRoundTableSpec(resolveGuestTableFt(ctx.tableSizeFt, 'round'))
                )
              }
              onRectToolClick={() =>
                activateTableSize(
                  guestRectTableSpec(
                    resolveGuestTableFt(ctx.tableSizeFt, 'rectangular')
                  )
                )
              }
              roundToolActive={isTablePlacementActive('guest-round')}
              rectToolActive={isTablePlacementActive('guest-rect')}
              compact={compact}
              className="min-w-0 shrink-0"
            />
          ) : null}
          {ctx.highlightedSelectionMetrics &&
          ctx.tableSizeFt?.purpose === 'guest' ? (
            <span
              className="hidden shrink-0 rounded-md border border-violet-200/90 bg-violet-50/80 px-2 py-1 text-[10px] font-semibold tabular-nums text-violet-900 sm:inline"
              aria-live="polite"
            >
              {ctx.highlightedSelectionMetrics}
            </span>
          ) : null}
          {ctx.onPatronAutoArrange ? (
            <>
              <div className={toolbarDividerClass(compact)} aria-hidden />
              <AutoArrangeGroup
                label="Patron auto-arrange"
                mode={ctx.patronAutoArrangeMode ?? 'grid'}
                onModeChange={ctx.onPatronAutoArrangeModeChange}
                onRun={ctx.onPatronAutoArrange}
                canRun={ctx.canPatronAutoArrange}
                runTitle="Auto-arrange patron in the active room (vendor stays put)"
                tone="violet"
                compact={compact}
              />
            </>
          ) : null}
        </div>
      )

    case 'room':
      return (
        <>
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
              sidebar={sidebarLayout}
            />
          ) : null}
          {ctx.onRotateRoomLeft && ctx.onRotateRoomRight ? (
            <>
              {(ctx.onSelectRoom && ctx.onAddRoom) ||
              ctx.onJoinRooms ||
              ctx.onUnjoinRoom ? (
                <div className={toolbarDividerClass(compact)} aria-hidden />
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
                  className="text-teal-900 hover:bg-teal-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </CommandButton>
                <CommandButton
                  onClick={ctx.onRotateRoomRight}
                  disabled={!canRotateRoom}
                  title={canRotateRoom ? `${rotateRoomHint} (right)` : rotateRoomHint}
                  className="text-teal-900 hover:bg-teal-100"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </CommandButton>
              </div>
            </>
          ) : null}
          {ctx.onJoinRooms || ctx.onUnjoinRoom ? (
            <>
              <div className={toolbarDividerClass(compact)} aria-hidden />
              <div
                className="flex items-center gap-0.5"
                role="group"
                aria-label="Room joining"
              >
                {ctx.onJoinRooms ? (
                  <CommandButton
                    onClick={ctx.onJoinRooms}
                    disabled={!ctx.canJoinRooms}
                    title={`${ctx.joinLabel} — ${ctx.joinTitle}`}
                    className="bg-sky-50 text-sky-900 hover:bg-sky-100"
                  >
                    <Combine className="h-3.5 w-3.5" />
                  </CommandButton>
                ) : null}
                {ctx.onUnjoinRoom ? (
                  <CommandButton
                    onClick={ctx.onUnjoinRoom}
                    disabled={!ctx.canUnjoinRoom}
                    title="Unjoin — split the active room out of its joined zone"
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
          >
            <Locate className="h-3.5 w-3.5" />
          </CommandButton>
          <div className={toolbarDividerClass(compact)} aria-hidden />
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="Alignment and spacing"
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
            <div className={toolbarDividerClass(compact)} aria-hidden />
            <CommandButton
              onClick={ctx.onDistributeHorizontal}
              disabled={!canDistribute}
              title="Distribute equal horizontal spacing (3+ objects)"
            >
              <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onDistributeVertical}
              disabled={!canDistribute}
              title="Distribute equal vertical spacing (3+ objects)"
            >
              <AlignVerticalDistributeCenter className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        </>
      )

    case 'utilities':
      if (sidebarLayout) {
        return (
          <div
            className={cn(
              'inline-flex w-full items-center overflow-hidden rounded-md border border-stone-200',
              toolbarControlHeight(compact)
            )}
          >
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
              className="inline-flex h-full min-w-[3rem] flex-1 items-center justify-center border-x border-stone-200 px-1.5 text-[11px] font-semibold tabular-nums text-stone-700 hover:bg-stone-100"
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
        )
      }
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
          <div
            className={cn(
              'inline-flex items-center overflow-hidden rounded-md border border-stone-200',
              toolbarControlHeight(compact)
            )}
          >
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
            <TooltipWrapper
              text={
                ctx.saveMarketLoading
                  ? 'Saving market…'
                  : 'Save market and deploy'
              }
            >
              <button
                type="button"
                onClick={ctx.onSaveMarket}
                disabled={ctx.saveMarketDisabled || ctx.saveMarketLoading}
                aria-label={
                  ctx.saveMarketLoading
                    ? 'Saving market'
                    : 'Save market and deploy'
                }
                className={cn(
                  'inline-flex shrink-0 items-center justify-center rounded-md bg-stone-900 p-0 text-white hover:bg-stone-800 disabled:opacity-40',
                  toolbarIconButtonSize(compact)
                )}
              >
                <Save className="h-3.5 w-3.5" />
              </button>
            </TooltipWrapper>
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
  const ids: CanvasToolbarBlockId[] = []
  if (ctx.showRoom) ids.push('room')
  if (ctx.showPatron) ids.push('patron')
  if (ctx.showVendor) ids.push('vendor')
  ids.push('utilities')
  ids.push('primitives', 'history-clipboard', 'view-align')
  return ids
}

/** Row groups for the fixed dashboard ribbon (room+tools → patron+vendor). */
export function getStaticToolbarRowGroups(ctx: {
  needsRoomFirst: boolean
  showVendor: boolean
  showPatron: boolean
  showRoom: boolean
}): CanvasToolbarBlockId[][] {
  if (ctx.needsRoomFirst && ctx.showRoom) {
    return [['room']]
  }

  const rows: CanvasToolbarBlockId[][] = []

  const roomToolsRow: CanvasToolbarBlockId[] = []
  if (ctx.showRoom) roomToolsRow.push('room')
  if (!ctx.needsRoomFirst) {
    roomToolsRow.push('primitives', 'history-clipboard', 'view-align', 'utilities')
  }
  if (roomToolsRow.length > 0) rows.push(roomToolsRow)

  const placementRow: CanvasToolbarBlockId[] = []
  if (ctx.showPatron) placementRow.push('patron')
  if (ctx.showVendor) placementRow.push('vendor')
  if (placementRow.length > 0) rows.push(placementRow)

  return rows
}
