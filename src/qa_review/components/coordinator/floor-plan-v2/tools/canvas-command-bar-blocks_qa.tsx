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
import type { AutoArrangeMode } from '@/components/coordinator/floor-plan-v2/engine/auto-arrange'
import {
  AUTO_ARRANGE_TRAFFIC_PREREQ_TOOLTIP,
} from '@/components/coordinator/floor-plan-v2/engine/traffic-flow-prerequisites'
import type { DrawShape, ToolState } from '@/components/coordinator/floor-plan-v2/tools/types'
import {
  QA_TIP_ALIGN_H,
  QA_TIP_ALIGN_V,
  QA_TIP_ARRANGE_MODE,
  QA_TIP_AUTO_ARRANGE,
  QA_TIP_BANQUET_TABLE,
  QA_TIP_CANT_MERGE,
  QA_TIP_CENTER,
  QA_TIP_CLEAR_ALL,
  QA_TIP_COPY,
  QA_TIP_EXIT_FULLSCREEN,
  QA_TIP_FULLSCREEN,
  QA_TIP_HAND,
  QA_TIP_LABELS_OFF,
  QA_TIP_LABELS_ON,
  QA_TIP_PASTE,
  QA_TIP_REDO,
  QA_TIP_ROTATE_LEFT,
  QA_TIP_ROTATE_RIGHT,
  QA_TIP_ROTATE_ROOM,
  QA_TIP_ROTATE_ROOM_LEFT,
  QA_TIP_ROTATE_ROOM_RIGHT,
  QA_TIP_ROUND_TABLE,
  QA_TIP_SAVE,
  QA_TIP_SAVING,
  QA_TIP_SELECT,
  QA_TIP_SELECT_ROOM,
  QA_TIP_SELECT_TO_MERGE,
  QA_TIP_SPACE_H,
  QA_TIP_SPACE_V,
  QA_TIP_UNDO,
  QA_TIP_UNJOIN,
  QA_TIP_VENDOR_DRAW,
  QA_TIP_ZOOM_IN,
  QA_TIP_ZOOM_OUT,
  QA_TIP_ZOOM_RESET,
  qaTipDelete,
} from '@/src/qa_review/components/coordinator/floor-plan-v2/tools/toolbar-tooltip-copy_qa'
import { cn } from '@/lib/utils'
import {
  CommandButtonQa as CommandButton,
  toolbarControlHeight,
  toolbarDividerClass,
  toolbarIconButtonSize,
} from '@/src/qa_review/components/coordinator/floor-plan-v2/tools/command-button_qa'
import {
  TableSizePill,
  PatronTableSizeRows,
  PatronSidebarControls,
  VendorSidebarSizeGrid,
} from '@/components/coordinator/floor-plan-v2/tools/table-size-pill'
import type { CanvasToolbarBlockId } from '@/components/coordinator/floor-plan-v2/tools/toolbar-order'
import {
  guestRectTableSpec,
  guestRoundTableSpec,
  isGuestTableLengthFt,
  vendorTableSpec,
  type GuestTableLengthFt,
  type TableSizeSpec,
} from '@/lib/booth-planner/table-shape'
import { TooltipWrapperQa } from '@/src/qa_review/components/coordinator/dashboard/tooltip-wrapper_qa'
import { QA_ADD_ROOM_FORM_CLASS } from '@/src/qa_review/components/coordinator/floor-plan-v2/canvas/Canvas_qa'

type TablePlacementMode = 'vendor' | 'guest-round' | 'guest-rect'

function FloorPlanOptimizeControl({
  mode,
  onModeChange,
  onRun,
  canRun,
  disabledReason,
  compact,
  sidebarLayout,
}: {
  mode: AutoArrangeMode
  onModeChange?: (mode: AutoArrangeMode) => void
  onRun?: () => void
  canRun?: boolean
  disabledReason?: string | null
  compact?: boolean
  sidebarLayout?: boolean
}) {
  if (!onRun) return null
  const tooltip = canRun
    ? 'Optimize vendor booths and patron seating together in one pass'
    : (disabledReason ?? AUTO_ARRANGE_TRAFFIC_PREREQ_TOOLTIP)

  const content = (
    <div
      className={cn(
        'flex min-w-0 gap-1',
        sidebarLayout ? 'w-full flex-col' : 'inline-flex items-center'
      )}
      role="group"
      aria-label="Auto-arrange floor plan"
    >
      {onModeChange ? (
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as AutoArrangeMode)}
          title={QA_TIP_ARRANGE_MODE}
          aria-label="Floor plan placement mode"
          disabled={!canRun}
          className={cn(
            'rounded-md border border-stone-200 bg-white px-2 text-[11px] font-semibold text-stone-700 disabled:opacity-50',
            toolbarControlHeight(compact ?? false),
            sidebarLayout && 'w-full'
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
        title={tooltip}
        className={cn(
          'gap-1.5 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 disabled:opacity-50',
          sidebarLayout && 'w-full justify-center px-3'
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
        {sidebarLayout ? (
          <span className="text-[11px] font-semibold">Auto-Arrange Floor Plan</span>
        ) : (
          <span className="hidden text-[11px] font-semibold lg:inline">
            Auto-Arrange Floor Plan
          </span>
        )}
      </CommandButton>
    </div>
  )

  return (
    <TooltipWrapperQa text={tooltip} className={sidebarLayout ? 'w-full' : undefined}>
      {content}
    </TooltipWrapperQa>
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
  onAutoArrangeFloorPlan?: () => void
  canAutoArrangeFloorPlan?: boolean
  autoArrangeDisabledReason?: string | null
  autoArrangeMode?: AutoArrangeMode
  onAutoArrangeModeChange?: (mode: AutoArrangeMode) => void
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
  joinBlockedReason?: string | null
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
  onSaveDraft?: () => void
  saveDraftDisabled?: boolean
  saveDraftLoading?: boolean
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
  const rotateRoomHint = rotateRoomId ? QA_TIP_ROTATE_ROOM : QA_TIP_SELECT_ROOM

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
            className="flex w-full min-w-0 flex-row flex-nowrap items-center gap-0.5 overflow-x-auto"
            role="group"
            aria-label="Designer tools"
          >
            <CommandButton
              onClick={() => ctx.onToolChange('select')}
              title={QA_TIP_SELECT}
              active={ctx.toolState.tool === 'select'}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={() => ctx.onToolChange('hand')}
              title={QA_TIP_HAND}
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
              title={qaTipDelete(ctx.selectedCount)}
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
              title={QA_TIP_SELECT}
              active={ctx.toolState.tool === 'select'}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={() => ctx.onToolChange('hand')}
              title={QA_TIP_HAND}
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
              title={qaTipDelete(ctx.selectedCount)}
              className="text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onClearAll}
              title={QA_TIP_CLEAR_ALL}
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
            className="flex min-w-0 flex-row flex-nowrap items-center gap-0.5 overflow-hidden"
            role="group"
            aria-label="History"
          >
            <CommandButton
              onClick={ctx.onUndo}
              disabled={!ctx.canUndo}
              title={QA_TIP_UNDO}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onRedo}
              disabled={!ctx.canRedo}
              title={QA_TIP_REDO}
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
              title={QA_TIP_UNDO}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onRedo}
              disabled={!ctx.canRedo}
              title={QA_TIP_REDO}
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
              title={QA_TIP_COPY}
            >
              <Copy className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onPaste}
              disabled={!ctx.clipboardHasContents}
              title={QA_TIP_PASTE}
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onRotateLeft}
              disabled={!hasSelection}
              title={QA_TIP_ROTATE_LEFT}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onRotateRight}
              disabled={!hasSelection}
              title={QA_TIP_ROTATE_RIGHT}
            >
              <RotateCw className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        </>
      )

    case 'optimize':
      return (
        <FloorPlanOptimizeControl
          mode={ctx.autoArrangeMode ?? 'grid'}
          onModeChange={ctx.onAutoArrangeModeChange}
          onRun={ctx.onAutoArrangeFloorPlan}
          canRun={ctx.canAutoArrangeFloorPlan}
          disabledReason={ctx.autoArrangeDisabledReason}
          compact={compact}
          sidebarLayout={sidebarLayout}
        />
      )

    case 'vendor-sizes':
      if (!sidebarLayout || !ctx.onTableSizeChange || ctx.tableSizeFt == null) {
        return null
      }
      return (
        <div className="relative w-full min-w-0 shrink-0">
          <VendorSidebarSizeGrid
            value={ctx.tableSizeFt}
            onChange={activateTableSize}
            compact={compact}
            className="min-w-0"
          />
          {ctx.highlightedSelectionMetrics &&
          ctx.tableSizeFt.purpose !== 'guest' ? (
            <span
              className="pointer-events-none absolute right-0 top-full z-10 mt-1 w-[10.5rem] truncate rounded-md border border-amber-200/90 bg-amber-50/95 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-amber-900"
              aria-live="polite"
            >
              {ctx.highlightedSelectionMetrics}
            </span>
          ) : null}
        </div>
      )

    case 'vendor':
      if (sidebarLayout) {
        return (
          <div className="flex min-w-0 flex-row flex-nowrap items-center gap-0.5 overflow-hidden">
            <CommandButton
              onClick={() => activateTablePlacement('vendor')}
              title={QA_TIP_VENDOR_DRAW}
              active={isTablePlacementActive('vendor')}
              className={cn(
                'shrink-0',
                isTablePlacementActive('vendor')
                  ? 'bg-amber-200 text-amber-950 hover:bg-amber-200'
                  : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100'
              )}
            >
              <Square className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        )
      }
      return (
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-0.5">
          <CommandButton
            onClick={() => activateTablePlacement('vendor')}
            title={QA_TIP_VENDOR_DRAW}
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
        </div>
      )

    case 'room':
      return (
        <>
          {ctx.onSelectRoom &&
          ctx.onAddRoom &&
          ctx.onRenameRoom &&
          ctx.onDeleteRoom ? (
            <div className={QA_ADD_ROOM_FORM_CLASS}>
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
            </div>
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
                  title={canRotateRoom ? QA_TIP_ROTATE_ROOM_LEFT : rotateRoomHint}
                  className="text-teal-900 hover:bg-teal-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </CommandButton>
                <CommandButton
                  onClick={ctx.onRotateRoomRight}
                  disabled={!canRotateRoom}
                  title={canRotateRoom ? QA_TIP_ROTATE_ROOM_RIGHT : rotateRoomHint}
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
                    title={
                      ctx.canJoinRooms
                        ? ctx.joinLabel
                        : ctx.joinBlockedReason
                          ? QA_TIP_CANT_MERGE
                          : QA_TIP_SELECT_TO_MERGE
                    }
                    className="bg-sky-50 text-sky-900 hover:bg-sky-100"
                  >
                    <Combine className="h-3.5 w-3.5" />
                  </CommandButton>
                ) : null}
                {ctx.onUnjoinRoom ? (
                  <CommandButton
                    onClick={ctx.onUnjoinRoom}
                    disabled={!ctx.canUnjoinRoom}
                    title={QA_TIP_UNJOIN}
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
      if (sidebarLayout) {
        return (
          <div className="flex w-full min-w-0 flex-col gap-2">
            <div className="flex min-w-0 flex-row flex-nowrap items-center gap-0.5 overflow-x-auto">
              <CommandButton
                onClick={ctx.onCenterView}
                title={QA_TIP_CENTER}
                className="shrink-0"
              >
                <Locate className="h-3.5 w-3.5" />
              </CommandButton>
              {ctx.onShowLabelsChange ? (
                <CommandButton
                  onClick={() => ctx.onShowLabelsChange!(!ctx.showLabels)}
                  title={ctx.showLabels ? QA_TIP_LABELS_OFF : QA_TIP_LABELS_ON}
                  className={cn(
                    'shrink-0',
                    ctx.showLabels ? 'bg-sky-50 text-sky-900 hover:bg-sky-100' : undefined
                  )}
                >
                  {ctx.showLabels ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </CommandButton>
              ) : null}
            </div>
            <div
              className="flex min-w-0 flex-row flex-nowrap items-center gap-0.5 overflow-x-auto"
              role="group"
              aria-label="Alignment and spacing"
            >
              <CommandButton
                onClick={ctx.onAlignVertical}
                disabled={!canAlign}
                title={QA_TIP_ALIGN_V}
                className="shrink-0"
              >
                <AlignCenterVertical className="h-3.5 w-3.5" />
              </CommandButton>
              <CommandButton
                onClick={ctx.onAlignHorizontal}
                disabled={!canAlign}
                title={QA_TIP_ALIGN_H}
                className="shrink-0"
              >
                <AlignCenterHorizontal className="h-3.5 w-3.5" />
              </CommandButton>
              <CommandButton
                onClick={ctx.onDistributeHorizontal}
                disabled={!canDistribute}
                title={QA_TIP_SPACE_H}
                className="shrink-0"
              >
                <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
              </CommandButton>
              <CommandButton
                onClick={ctx.onDistributeVertical}
                disabled={!canDistribute}
                title={QA_TIP_SPACE_V}
                className="shrink-0"
              >
                <AlignVerticalDistributeCenter className="h-3.5 w-3.5" />
              </CommandButton>
            </div>
          </div>
        )
      }
      return (
        <>
          <CommandButton
            onClick={ctx.onCenterView}
            title={QA_TIP_CENTER}
          >
            <Locate className="h-3.5 w-3.5" />
          </CommandButton>
          <div className={toolbarDividerClass(compact)} aria-hidden />
          <div
            className="flex flex-row flex-nowrap items-center gap-0.5 overflow-hidden"
            role="group"
            aria-label="Alignment and spacing"
          >
            <CommandButton
              onClick={ctx.onAlignVertical}
              disabled={!canAlign}
              title={QA_TIP_ALIGN_V}
            >
              <AlignCenterVertical className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onAlignHorizontal}
              disabled={!canAlign}
              title={QA_TIP_ALIGN_H}
            >
              <AlignCenterHorizontal className="h-3.5 w-3.5" />
            </CommandButton>
            <div className={toolbarDividerClass(compact)} aria-hidden />
            <CommandButton
              onClick={ctx.onDistributeHorizontal}
              disabled={!canDistribute}
              title={QA_TIP_SPACE_H}
            >
              <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onDistributeVertical}
              disabled={!canDistribute}
              title={QA_TIP_SPACE_V}
            >
              <AlignVerticalDistributeCenter className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        </>
      )

    case 'utilities':
      if (sidebarLayout) {
        return (
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            <div
              className="flex min-w-0 flex-row flex-wrap items-center gap-0.5"
              role="group"
              aria-label="Canvas view options"
            >
              {ctx.onShowLabelsChange ? (
                <CommandButton
                  onClick={() => ctx.onShowLabelsChange!(!ctx.showLabels)}
                  title={ctx.showLabels ? QA_TIP_LABELS_OFF : QA_TIP_LABELS_ON}
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
                    ctx.canvasFullscreen ? QA_TIP_EXIT_FULLSCREEN : QA_TIP_FULLSCREEN
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
              {ctx.onSaveDraft ? (
                <TooltipWrapperQa
                  text={
                    ctx.saveDraftLoading ? QA_TIP_SAVING : 'Save layout draft'
                  }
                >
                  <button
                    type="button"
                    onClick={ctx.onSaveDraft}
                    disabled={ctx.saveDraftDisabled || ctx.saveDraftLoading}
                    aria-label="Save layout draft"
                    className={cn(
                      'inline-flex shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white p-0 text-stone-800 hover:bg-stone-50 disabled:opacity-40',
                      toolbarIconButtonSize(compact)
                    )}
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </TooltipWrapperQa>
              ) : null}
              {ctx.onSaveMarket ? (
                <TooltipWrapperQa
                  text={ctx.saveMarketLoading ? QA_TIP_SAVING : QA_TIP_SAVE}
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
                </TooltipWrapperQa>
              ) : null}
            </div>
            <div
              className={cn(
                'inline-flex w-full items-center overflow-hidden rounded-md border border-stone-200',
                toolbarControlHeight(compact)
              )}
            >
              <button
                type="button"
                onClick={ctx.onZoomOut}
                title={QA_TIP_ZOOM_OUT}
                aria-label="Zoom out"
                className="inline-flex h-full w-7 items-center justify-center text-stone-600 hover:bg-stone-100"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={ctx.onZoomReset}
                title={QA_TIP_ZOOM_RESET}
                aria-label="Reset zoom"
                className="inline-flex h-full flex-1 min-w-[3.25rem] items-center justify-center border-x border-stone-200 px-1.5 text-[11px] font-semibold tabular-nums text-stone-700 hover:bg-stone-100"
              >
                {Math.round(ctx.zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={ctx.onZoomIn}
                title={QA_TIP_ZOOM_IN}
                aria-label="Zoom in"
                className="inline-flex h-full w-7 items-center justify-center text-stone-600 hover:bg-stone-100"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      }
      return (
        <>
          {ctx.onShowLabelsChange ? (
            <CommandButton
              onClick={() => ctx.onShowLabelsChange!(!ctx.showLabels)}
              title={ctx.showLabels ? QA_TIP_LABELS_OFF : QA_TIP_LABELS_ON}
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
              title={ctx.canvasFullscreen ? QA_TIP_EXIT_FULLSCREEN : QA_TIP_FULLSCREEN}
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
              title={QA_TIP_ZOOM_OUT}
              aria-label="Zoom out"
              className="inline-flex h-full w-7 items-center justify-center text-stone-600 hover:bg-stone-100"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={ctx.onZoomReset}
              title={QA_TIP_ZOOM_RESET}
              aria-label="Reset zoom"
              className="inline-flex h-full min-w-[3rem] items-center justify-center border-x border-stone-200 px-1.5 text-[11px] font-semibold tabular-nums text-stone-700 hover:bg-stone-100"
            >
              {Math.round(ctx.zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={ctx.onZoomIn}
              title={QA_TIP_ZOOM_IN}
              aria-label="Zoom in"
              className="inline-flex h-full w-7 items-center justify-center text-stone-600 hover:bg-stone-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {ctx.onSaveMarket ? (
            <TooltipWrapperQa
              text={ctx.saveMarketLoading ? QA_TIP_SAVING : QA_TIP_SAVE}
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
            </TooltipWrapperQa>
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
  showOptimize?: boolean
}): CanvasToolbarBlockId[] {
  if (ctx.needsRoomFirst && ctx.showRoom) {
    return ['room']
  }
  const ids: CanvasToolbarBlockId[] = []
  if (ctx.showRoom) ids.push('room')
  if ((ctx.showPatron || ctx.showVendor) && ctx.showOptimize) ids.push('optimize')
  if (ctx.showPatron) ids.push('patron')
  if (ctx.showVendor) ids.push('vendor')
  ids.push('utilities')
  ids.push('primitives', 'history-clipboard', 'view-align')
  return ids
}

/** Row groups for the fixed dashboard ribbon (room → patron/vendor → tools). */
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
  if (ctx.showPatron || ctx.showVendor) placementRow.push('optimize')
  if (ctx.showPatron) placementRow.push('patron')
  if (ctx.showVendor) placementRow.push('vendor')
  if (placementRow.length > 0) rows.push(placementRow)

  return rows
}
