'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  ClipboardPaste,
  Copy,
  DoorOpen,
  Expand,
  Hand,
  LayoutGrid,
  Locate,
  Minimize2,
  Minus,
  Monitor,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Siren,
  Square,
  Tag,
  Trash2,
  Truck,
  Undo2,
  RectangleHorizontal,
  Eye,
  EyeOff,
  Route,
  AlertTriangle,
} from 'lucide-react'
import { LayoutRoomBar } from '@/components/coordinator/layout-room-bar'
import type { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import {
  DEFAULT_TABLE_SIZE,
  isLayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import type { AutoArrangeMode } from '../engine/auto-arrange'
import {
  AUTO_ARRANGE_TRAFFIC_PREREQ_TOOLTIP,
} from '../engine/traffic-flow-prerequisites'
import type { DrawShape, ToolState } from './types'
import { TestSuitePopulateButton } from '@/components/coordinator/test-suite-populate-button'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { cn } from '@/lib/utils'
import { VENDOR_BOOTH_TOOLBAR } from '@/components/coordinator/floor-plan-v2/canvas/placement-theme'
import { formatDiscreteZoomPercent } from '@/lib/floor-plan/discrete-zoom'
import { BOOTH_MAP_LABEL_OPTIONS } from '@/lib/coordinator/booth-map-label'
import {
  CommandButton,
  toolbarControlHeight,
  toolbarDividerClass,
  toolbarIconButtonSize,
} from './command-button'
import { LayoutEditorHelpButton } from './layout-editor-help'
import {
  TableSizePill,
  PatronTableSizeRows,
  PatronSidebarControls,
  VendorSidebarSizeGrid,
} from './table-size-pill'
import type { DualScreenMode } from '@/lib/coordinator/floorplan-sync'
import { FillRoomControl } from './fill-room-control'
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

function lightGreenToolbarButtonClass(compact: boolean, active = false) {
  return cn(
    'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2 text-[11px] font-semibold',
    toolbarControlHeight(compact),
    active
      ? 'border-emerald-600 bg-emerald-200 text-emerald-950 hover:bg-emerald-200'
      : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
  )
}

function DualScreenLaunchButtons({
  onLaunchDualScreen,
  compact,
  variant = 'subtle',
  iconOnly = false,
}: {
  onLaunchDualScreen: (mode: DualScreenMode) => void
  compact: boolean
  variant?: 'prominent' | 'subtle'
  /** Header row — square icon buttons matching toolbar height. */
  iconOnly?: boolean
}) {
  if (iconOnly) {
    const iconClass = cn(
      'inline-flex shrink-0 items-center justify-center rounded-md border p-0',
      toolbarIconButtonSize(compact),
      variant === 'prominent'
        ? 'border-emerald-600 bg-emerald-700 text-white hover:bg-emerald-800'
        : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
    )
    return (
      <>
        <button
          type="button"
          onClick={() => onLaunchDualScreen('presenter')}
          title="Presenter — interactive booth matrix"
          aria-label="Open presenter dual-screen view"
          className={iconClass}
        >
          <Monitor className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onLaunchDualScreen('wall-cast')}
          title="Wall Cast — read-only booth matrix"
          aria-label="Open wall cast dual-screen view"
          className={iconClass}
        >
          <Monitor className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
      </>
    )
  }

  const buttonClass =
    variant === 'prominent'
      ? cn(
          'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-emerald-600 bg-emerald-700 px-2 text-[11px] font-semibold text-white hover:bg-emerald-800',
          toolbarControlHeight(compact)
        )
      : cn(
          'inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100',
          toolbarControlHeight(compact)
        )

  return (
    <>
      <button
        type="button"
        onClick={() => onLaunchDualScreen('presenter')}
        title="Open interactive booth matrix for presenter view"
        className={buttonClass}
      >
        <Monitor className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Presenter
      </button>
      <button
        type="button"
        onClick={() => onLaunchDualScreen('wall-cast')}
        title="Open read-only booth matrix for wall display"
        className={buttonClass}
      >
        <Monitor className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Wall Cast
      </button>
    </>
  )
}

function FloorPlanOptimizeControl({
  mode,
  onModeChange,
  onRun,
  canRun,
  disabledReason,
  compact,
  sidebarLayout,
  topBarLayout,
}: {
  mode: AutoArrangeMode
  onModeChange?: (mode: AutoArrangeMode) => void
  onRun?: () => void
  canRun?: boolean
  disabledReason?: string | null
  compact?: boolean
  sidebarLayout?: boolean
  topBarLayout?: boolean
}) {
  if (!onRun) return null
  const tooltip =
    canRun
      ? 'Optimize vendor booths and patron seating together in one pass'
      : (disabledReason ?? AUTO_ARRANGE_TRAFFIC_PREREQ_TOOLTIP)

  const content = (
    <div
      className={cn(
        'flex min-w-0 gap-1',
        sidebarLayout ? 'w-full flex-col gap-1.5' : 'inline-flex items-center'
      )}
      role="group"
      aria-label="Auto-arrange floor plan"
    >
      {onModeChange ? (
        sidebarLayout ? (
          <div className="flex items-center justify-between gap-1 text-xs text-slate-500">
            <span className="shrink-0 font-medium">Pattern:</span>
            <div className="flex min-w-0 flex-wrap justify-end gap-1">
              {(
                [
                  { id: 'grid' as const, label: 'Grid' },
                  { id: 'staggered' as const, label: 'Staggered' },
                  { id: 'perimeter-only' as const, label: 'Perimeter' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  disabled={!canRun}
                  onClick={() => onModeChange(id)}
                  aria-pressed={mode === id}
                  className={cn(
                    'rounded px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50',
                    mode === id
                      ? 'bg-slate-200 text-slate-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <select
            value={mode}
            onChange={(e) => onModeChange(e.target.value as AutoArrangeMode)}
            title="Floor plan placement mode"
            aria-label="Floor plan placement mode"
            disabled={!canRun}
            className={cn(
              'rounded-md border border-stone-200 bg-white px-2 text-[11px] font-semibold text-stone-700 disabled:opacity-50',
              toolbarControlHeight(compact ?? false)
            )}
          >
            <option value="grid">Grid</option>
            <option value="staggered">Staggered</option>
            <option value="perimeter-only">Perimeter</option>
          </select>
        )
      ) : null}
      {topBarLayout ? (
        <TooltipWrapper text={tooltip}>
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun}
            title={tooltip}
            className={cn(
              'inline-flex w-32 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-600 bg-emerald-700 px-3 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50',
              toolbarControlHeight(compact ?? false)
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
            AI Auto-Arrange
          </button>
        </TooltipWrapper>
      ) : (
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
            <span className="text-[11px] font-semibold">Auto-Arrange</span>
          )}
        </CommandButton>
      )}
    </div>
  )

  if (sidebarLayout) {
    return (
      <TooltipWrapper text={tooltip} className="w-full">
        {content}
      </TooltipWrapper>
    )
  }

  return (
    <TooltipWrapper text={tooltip}>
      {content}
    </TooltipWrapper>
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
  {
    id: 'food_truck',
    label: 'Food truck',
    icon: Truck,
    variant: 'arch',
  },
]

function LayoutToolbarHelpTrigger({ compact }: { compact: boolean }) {
  return (
    <LayoutEditorHelpButton
      variant="prominent"
      size="sm"
      className={cn('shrink-0 shadow-sm', toolbarControlHeight(compact), 'px-2.5')}
    />
  )
}

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
  highlightedRoomId?: string | null
  onPatchRoomDimensions?: (
    roomId: string,
    patch: { widthFt: number; lengthFt: number }
  ) => void
  /** W×H label for the single selected canvas object (booth/table). */
  highlightedSelectionMetrics?: string | null
  showLabels?: boolean
  onShowLabelsChange?: (show: boolean) => void
  boothMapLabelMode?: import('@/lib/coordinator/booth-map-label').BoothMapLabelMode
  onBoothMapLabelModeChange?: (
    mode: import('@/lib/coordinator/booth-map-label').BoothMapLabelMode
  ) => void
  canvasFullscreen?: boolean
  onToggleCanvasFullscreen?: () => void
  onLaunchDualScreen?: (mode: DualScreenMode) => void
  dualScreenActive?: boolean
  designerExitHref?: string | null
  designerExitLabel?: string
  onDesignerExit?: () => void
  onSaveMarket?: () => void
  saveMarketDisabled?: boolean
  saveMarketLoading?: boolean
  onSaveDraft?: () => void
  saveDraftDisabled?: boolean
  saveDraftLoading?: boolean
  patronPathEnabled?: boolean
  onPatronPathToggle?: () => void
  showClearanceWarnings?: boolean
  onClearanceWarningsToggle?: () => void
  onRequestAiLayoutFeedback?: () => void
  canRequestAiLayoutFeedback?: boolean
  aiLayoutFeedbackLoading?: boolean
  vendorFillMaxCapacity?: number
  patronFillMaxCapacity?: number
  onFillVendorTables?: (count: number) => void
  onFillPatronTables?: (count: number) => void
  fillRoomDisabledReason?: string | null
  eventId?: string | null
  /** Static dashboard ribbon — tighter control heights (~10% shorter). */
  compact?: boolean
  /** Left-rail layout designer sidebar — stacked columns and split headers. */
  sidebarLayout?: boolean
  /** Dashboard top strip — horizontal tool groups below the header. */
  topBarLayout?: boolean
  /** Dashboard header row — view/setup + hall management. */
  headerBarLayout?: boolean
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
  const topBarLayout = ctx.topBarLayout ?? false
  const headerBarLayout = ctx.headerBarLayout ?? false
  const dashboardStripLayout = topBarLayout || headerBarLayout
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

  const vendorPlacementActive = isTablePlacementActive('vendor')
  const roundPlacementActive = isTablePlacementActive('guest-round')
  const rectPlacementActive = isTablePlacementActive('guest-rect')

  switch (id) {
    case 'primitives':
      if (sidebarLayout) {
        return (
          <div
            data-layout-help="draw-tools"
            className="flex w-full min-w-0 flex-row flex-nowrap items-center gap-0.5 overflow-x-auto"
            role="group"
            aria-label="Designer tools"
          >
            <div
              data-layout-help="navigation"
              className="inline-flex shrink-0 items-center gap-0.5"
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
            {ctx.onPatronPathToggle ? (
              <CommandButton
                onClick={ctx.onPatronPathToggle}
                title={
                  ctx.patronPathEnabled
                    ? 'Hide patron walk path overlay'
                    : 'Show patron walk path overlay'
                }
                active={ctx.patronPathEnabled}
                className={
                  ctx.patronPathEnabled
                    ? 'bg-sky-200 text-sky-950 hover:bg-sky-200'
                    : 'text-sky-800 hover:bg-sky-50'
                }
              >
                <Route className="h-3.5 w-3.5" />
              </CommandButton>
            ) : null}
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
            data-layout-help="navigation"
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
            data-layout-help="draw-tools"
            className="flex flex-nowrap items-center gap-0.5 overflow-x-auto"
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
            {ctx.onPatronPathToggle ? (
              <CommandButton
                onClick={ctx.onPatronPathToggle}
                title={
                  ctx.patronPathEnabled
                    ? 'Hide patron walk path overlay'
                    : 'Show patron walk path overlay'
                }
                active={ctx.patronPathEnabled}
                className={
                  ctx.patronPathEnabled
                    ? 'bg-sky-200 text-sky-950 hover:bg-sky-200'
                    : 'text-sky-800 hover:bg-sky-50'
                }
              >
                <Route className="h-3.5 w-3.5" />
              </CommandButton>
            ) : null}
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
            className="flex min-w-0 flex-row flex-nowrap items-center gap-0.5 overflow-hidden"
            role="group"
            aria-label="History"
          >
            <CommandButton
              onClick={ctx.onUndo}
              disabled={!ctx.canUndo}
              title="Undo (Ctrl+Z)"
              className="shrink-0"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </CommandButton>
            <CommandButton
              onClick={ctx.onRedo}
              disabled={!ctx.canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="shrink-0"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        )
      }
      if (headerBarLayout) {
        return (
          <div
            className="flex flex-row flex-nowrap items-center gap-0.5 overflow-hidden"
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
            className="flex flex-row flex-nowrap items-center gap-0.5 overflow-hidden"
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

    case 'vendor-sizes':
      if (!ctx.onTableSizeChange || ctx.tableSizeFt == null) {
        return null
      }
      if (sidebarLayout) {
        return (
          <div className="relative flex w-full min-w-0 shrink-0 flex-col gap-1.5">
            <VendorSidebarSizeGrid
              value={ctx.tableSizeFt}
              onChange={activateTableSize}
              compact={compact}
              className="min-w-0"
              placementActive={vendorPlacementActive}
            />
            {ctx.onFillVendorTables ? (
              <FillRoomControl
                scope="vendor"
                maxCapacity={ctx.vendorFillMaxCapacity ?? 0}
                disabled={Boolean(ctx.fillRoomDisabledReason)}
                disabledReason={ctx.fillRoomDisabledReason}
                onFill={ctx.onFillVendorTables}
                compact={compact}
                sidebarLayout
              />
            ) : null}
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
      }
      return (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <TableSizePill
            value={ctx.tableSizeFt}
            onChange={activateTableSize}
            sections="vendor"
            compact={compact}
            className="shrink-0"
            vendorPlacementActive={vendorPlacementActive}
          />
          {ctx.onFillVendorTables ? (
            <>
              <div className={toolbarDividerClass(compact)} aria-hidden />
              <FillRoomControl
                scope="vendor"
                maxCapacity={ctx.vendorFillMaxCapacity ?? 0}
                disabled={Boolean(ctx.fillRoomDisabledReason)}
                disabledReason={ctx.fillRoomDisabledReason}
                onFill={ctx.onFillVendorTables}
                compact={compact}
              />
            </>
          ) : null}
        </div>
      )

    case 'vendor':
      if (sidebarLayout || dashboardStripLayout) {
        return (
          <div
            data-layout-help="vendor-booths"
            className="flex min-w-0 flex-row flex-nowrap items-center gap-0.5 overflow-hidden"
          >
            <CommandButton
              onClick={() => activateTablePlacement('vendor')}
              title="Draw vendor — size from Vendor column"
              active={isTablePlacementActive('vendor')}
              className={cn(
                'shrink-0',
                isTablePlacementActive('vendor')
                  ? VENDOR_BOOTH_TOOLBAR.buttonActive
                  : VENDOR_BOOTH_TOOLBAR.buttonIdle
              )}
            >
              <Square className="h-3.5 w-3.5" />
            </CommandButton>
          </div>
        )
      }
      return (
        <div
          data-layout-help="vendor-booths"
          className="flex min-w-0 flex-wrap items-center justify-end gap-0.5"
        >
          <CommandButton
            onClick={() => activateTablePlacement('vendor')}
            title="Draw vendor — size from Vendor column"
            active={isTablePlacementActive('vendor')}
            className={
              isTablePlacementActive('vendor')
                ? VENDOR_BOOTH_TOOLBAR.buttonActive
                : VENDOR_BOOTH_TOOLBAR.buttonIdle
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
                vendorPlacementActive={vendorPlacementActive}
              />
              {ctx.highlightedSelectionMetrics &&
              ctx.tableSizeFt.purpose !== 'guest' ? (
                <span
                  className={cn(
                    'hidden shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold tabular-nums sm:inline',
                    VENDOR_BOOTH_TOOLBAR.metricsBadge
                  )}
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
      if (sidebarLayout || dashboardStripLayout) {
        return (
          <div className="flex w-full min-w-0 flex-row flex-nowrap items-center gap-1.5">
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
                className={dashboardStripLayout ? 'flex-row items-center' : undefined}
              />
            ) : null}
            {ctx.onFillPatronTables ? (
              <FillRoomControl
                scope="patron"
                maxCapacity={ctx.patronFillMaxCapacity ?? 0}
                disabled={Boolean(ctx.fillRoomDisabledReason)}
                disabledReason={ctx.fillRoomDisabledReason}
                onFill={ctx.onFillPatronTables}
                compact={compact}
              />
            ) : null}
          </div>
        )
      }
      return (
        <div className="flex min-w-0 flex-nowrap items-center gap-0.5">
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
          {ctx.onFillPatronTables ? (
            <>
              <div className={toolbarDividerClass(compact)} aria-hidden />
              <FillRoomControl
                scope="patron"
                maxCapacity={ctx.patronFillMaxCapacity ?? 0}
                disabled={Boolean(ctx.fillRoomDisabledReason)}
                disabledReason={ctx.fillRoomDisabledReason}
                onFill={ctx.onFillPatronTables}
                compact={compact}
              />
            </>
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

    case 'optimize':
      return (
        <div data-layout-help="optimize" className="inline-flex min-w-0">
          <FloorPlanOptimizeControl
            mode={ctx.autoArrangeMode ?? 'grid'}
            onModeChange={ctx.onAutoArrangeModeChange}
            onRun={ctx.onAutoArrangeFloorPlan}
            canRun={ctx.canAutoArrangeFloorPlan}
            disabledReason={ctx.autoArrangeDisabledReason}
            compact={compact}
            sidebarLayout={sidebarLayout}
            topBarLayout={topBarLayout}
          />
        </div>
      )

    case 'test-suite':
      if (!ctx.eventId) return null
      return <TestSuitePopulateButton eventId={ctx.eventId} compact={compact} />

    case 'room':
      if (sidebarLayout) {
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
                highlightedRoomId={ctx.highlightedRoomId}
                onPatchRoomDimensions={ctx.onPatchRoomDimensions}
                embedded
                sidebar
              />
            ) : null}
            <div
              className="mt-2 flex flex-row items-center gap-2"
              role="group"
              aria-label="Room actions"
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
              <CommandButton
                onClick={ctx.onRotateLeft}
                disabled={!hasSelection}
                title="Rotate -15°"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </CommandButton>
              <CommandButton
                onClick={ctx.onDeleteSelected}
                disabled={!hasSelection}
                title={`Delete ${ctx.selectedCount} selected`}
                className="text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </CommandButton>
              <CommandButton
                onClick={ctx.onCopy}
                disabled={!hasSelection}
                title="Copy selection (Ctrl+C)"
              >
                <Copy className="h-3.5 w-3.5" />
              </CommandButton>
            </div>
            {ctx.onRotateRoomLeft && ctx.onRotateRoomRight ? (
              <div
                className="mt-1.5 flex flex-row items-center gap-2"
                role="group"
                aria-label="Rotate room"
              >
                <CommandButton
                  onClick={ctx.onRotateRoomLeft}
                  disabled={!canRotateRoom}
                  title={
                    canRotateRoom ? `${rotateRoomHint} (left)` : rotateRoomHint
                  }
                  className="text-teal-900 hover:bg-teal-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </CommandButton>
                <CommandButton
                  onClick={ctx.onRotateRoomRight}
                  disabled={!canRotateRoom}
                  title={
                    canRotateRoom ? `${rotateRoomHint} (right)` : rotateRoomHint
                  }
                  className="text-teal-900 hover:bg-teal-100"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </CommandButton>
              </div>
            ) : null}
          </>
        )
      }
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
              highlightedRoomId={ctx.highlightedRoomId}
              onPatchRoomDimensions={ctx.onPatchRoomDimensions}
              embedded
              headerBar={headerBarLayout}
              sidebar={sidebarLayout}
            />
          ) : null}
          {!headerBarLayout && ctx.onRotateRoomLeft && ctx.onRotateRoomRight ? (
            <>
              {ctx.onSelectRoom && ctx.onAddRoom ? (
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
        </>
      )

    case 'view-align':
      if (sidebarLayout) {
        return (
          <div className="flex w-full min-w-0 flex-col gap-2">
            <div className="flex min-w-0 flex-row flex-nowrap items-center gap-0.5 overflow-x-auto">
              <CommandButton
                onClick={ctx.onCenterView}
                title="Center view on all placed objects"
                className="shrink-0"
              >
                <Locate className="h-3.5 w-3.5" />
              </CommandButton>
              {ctx.onShowLabelsChange ? (
                <CommandButton
                  onClick={() => ctx.onShowLabelsChange!(!ctx.showLabels)}
                  title={
                    ctx.showLabels
                      ? 'Hide architectural labels'
                      : 'Show architectural labels'
                  }
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
                title="Align vertical centers (Shift+V)"
                className="shrink-0"
              >
                <AlignCenterVertical className="h-3.5 w-3.5" />
              </CommandButton>
              <CommandButton
                onClick={ctx.onAlignHorizontal}
                disabled={!canAlign}
                title="Align horizontal centers (Shift+H)"
                className="shrink-0"
              >
                <AlignCenterHorizontal className="h-3.5 w-3.5" />
              </CommandButton>
              <CommandButton
                onClick={ctx.onDistributeHorizontal}
                disabled={!canDistribute}
                title="Distribute equal horizontal spacing (3+ objects)"
                className="shrink-0"
              >
                <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
              </CommandButton>
              <CommandButton
                onClick={ctx.onDistributeVertical}
                disabled={!canDistribute}
                title="Distribute equal vertical spacing (3+ objects)"
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
            title="Center view on all placed objects"
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

    case 'dual-screen':
      if (!ctx.onLaunchDualScreen && !ctx.onToggleCanvasFullscreen) return null
      return (
        <>
          {ctx.onLaunchDualScreen ? (
            <DualScreenLaunchButtons
              onLaunchDualScreen={ctx.onLaunchDualScreen}
              compact={compact}
              variant="subtle"
              iconOnly={false}
            />
          ) : null}
          {(topBarLayout || headerBarLayout) && ctx.onToggleCanvasFullscreen ? (
            <button
              type="button"
              onClick={() => ctx.onToggleCanvasFullscreen?.()}
              title={
                ctx.canvasFullscreen
                  ? 'Exit full screen (Esc)'
                  : 'Expand canvas to fill the monitor'
              }
              className={lightGreenToolbarButtonClass(compact, ctx.canvasFullscreen)}
            >
              {ctx.canvasFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <Expand className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              {ctx.canvasFullscreen ? 'Exit full screen' : 'Full screen'}
            </button>
          ) : null}
        </>
      )

    case 'utilities':
      if (headerBarLayout) {
        return (
          <>
            {ctx.onBoothMapLabelModeChange ? (
              <>
                <div className={toolbarDividerClass(compact)} aria-hidden />
                <label
                  className={cn(
                    'inline-flex shrink-0 items-center rounded-md border border-stone-200 bg-white px-1',
                    toolbarControlHeight(compact)
                  )}
                >
                  <select
                    className="w-[9.5rem] rounded-md border-0 bg-transparent py-0 text-[10px] font-semibold text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    aria-label="Map labels — booth text overlay"
                    value={ctx.boothMapLabelMode ?? 'vendor'}
                    onChange={(e) =>
                      ctx.onBoothMapLabelModeChange!(
                        e.target.value as import('@/lib/coordinator/booth-map-label').BoothMapLabelMode
                      )
                    }
                  >
                    {BOOTH_MAP_LABEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            {ctx.onPatronPathToggle ? (
              <>
                <div className={toolbarDividerClass(compact)} aria-hidden />
                <CommandButton
                  onClick={ctx.onPatronPathToggle}
                  title={
                    ctx.patronPathEnabled
                      ? 'Hide patron flow aisles (6′ paths)'
                      : 'Toggle patron flow — show 6′ walking aisles'
                  }
                  active={ctx.patronPathEnabled}
                  className={
                    ctx.patronPathEnabled
                      ? 'bg-emerald-200 text-emerald-950 hover:bg-emerald-200'
                      : 'text-emerald-800 hover:bg-emerald-50'
                  }
                >
                  <Route className="h-3.5 w-3.5" />
                </CommandButton>
              </>
            ) : null}
            {ctx.onClearanceWarningsToggle ? (
              <>
                <div className={toolbarDividerClass(compact)} aria-hidden />
                <CommandButton
                  onClick={ctx.onClearanceWarningsToggle}
                  title={
                    ctx.showClearanceWarnings
                      ? 'Hide booth clearance warnings (yellow/red aisles)'
                      : 'Show booth clearance warnings — yellow at 3′–4′ aisles, red below 3′'
                  }
                  active={ctx.showClearanceWarnings}
                  className={
                    ctx.showClearanceWarnings
                      ? 'bg-amber-200 text-amber-950 hover:bg-amber-200'
                      : 'text-amber-800 hover:bg-amber-50'
                  }
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </CommandButton>
              </>
            ) : null}
            <div className={toolbarDividerClass(compact)} aria-hidden />
            <LayoutToolbarHelpTrigger compact={compact} />
            <div
              className={cn(
                'inline-flex shrink-0 items-center overflow-hidden rounded-md border border-stone-200',
                toolbarControlHeight(compact)
              )}
            >
              <button
                type="button"
                onClick={ctx.onZoomOut}
                title="Zoom out"
                aria-label="Zoom out"
                className={cn(
                  'inline-flex items-center justify-center text-stone-600 hover:bg-stone-100',
                  toolbarIconButtonSize(compact)
                )}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={ctx.onZoomReset}
                title="Reset zoom to 100%"
                aria-label="Reset zoom"
                className="inline-flex h-full min-w-[2.25rem] items-center justify-center border-x border-stone-200 px-1 text-[10px] font-semibold tabular-nums text-stone-700 hover:bg-stone-100"
              >
                {formatDiscreteZoomPercent(ctx.zoom, 0.25)}
              </button>
              <button
                type="button"
                onClick={ctx.onZoomIn}
                title="Zoom in"
                aria-label="Zoom in"
                className={cn(
                  'inline-flex items-center justify-center text-stone-600 hover:bg-stone-100',
                  toolbarIconButtonSize(compact)
                )}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )
      }
      if (dashboardStripLayout) {
        const topBarDivider = (
          <div className="h-4 w-[1px] shrink-0 bg-gray-300" aria-hidden />
        )
        return (
          <>
            <div
              className="flex items-center space-x-2"
              role="group"
              aria-label="Canvas navigation"
            >
              {ctx.onToggleCanvasFullscreen ? (
                <button
                  type="button"
                  onClick={() => ctx.onToggleCanvasFullscreen?.()}
                  title={
                    ctx.canvasFullscreen
                      ? 'Exit full screen (Esc)'
                      : 'Expand canvas to fill the monitor'
                  }
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-stone-300 bg-white px-2 text-[11px] font-semibold text-stone-800 hover:bg-stone-50',
                    ctx.canvasFullscreen &&
                      'border-stone-700 bg-stone-800 text-white hover:bg-stone-700',
                    toolbarControlHeight(compact)
                  )}
                >
                  {ctx.canvasFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : (
                    <Expand className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  {ctx.canvasFullscreen ? 'Exit full screen' : 'Full screen'}
                </button>
              ) : null}
            </div>
            {topBarDivider}
            <LayoutToolbarHelpTrigger compact={compact} />
            {ctx.onBoothMapLabelModeChange ? (
              <label
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 bg-white px-1.5 text-[10px] font-semibold text-stone-700',
                  toolbarControlHeight(compact)
                )}
              >
                <span className="hidden sm:inline">Map labels</span>
                <select
                  className="w-[9.5rem] rounded-lg border-0 bg-transparent py-0 text-[10px] font-semibold text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  aria-label="Map labels — booth text overlay"
                  value={ctx.boothMapLabelMode ?? 'vendor'}
                  onChange={(e) =>
                    ctx.onBoothMapLabelModeChange!(
                      e.target.value as import('@/lib/coordinator/booth-map-label').BoothMapLabelMode
                    )
                  }
                >
                  {BOOTH_MAP_LABEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {ctx.onPatronPathToggle ? (
              <CommandButton
                onClick={ctx.onPatronPathToggle}
                title={
                  ctx.patronPathEnabled
                    ? 'Hide patron flow aisles (6′ paths)'
                    : 'Toggle patron flow — show 6′ walking aisles'
                }
                active={ctx.patronPathEnabled}
                className={
                  ctx.patronPathEnabled
                    ? 'bg-emerald-200 text-emerald-950 hover:bg-emerald-200'
                    : 'text-emerald-800 hover:bg-emerald-50'
                }
              >
                <Route className="h-3.5 w-3.5" />
              </CommandButton>
            ) : null}
            {ctx.onClearanceWarningsToggle ? (
              <CommandButton
                onClick={ctx.onClearanceWarningsToggle}
                title={
                  ctx.showClearanceWarnings
                    ? 'Hide booth clearance warnings (yellow/red aisles)'
                    : 'Show booth clearance warnings — yellow at 3′–4′ aisles, red below 3′'
                }
                active={ctx.showClearanceWarnings}
                className={
                  ctx.showClearanceWarnings
                    ? 'bg-amber-200 text-amber-950 hover:bg-amber-200'
                    : 'text-amber-800 hover:bg-amber-50'
                }
              >
                <AlertTriangle className="h-3.5 w-3.5" />
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
                {formatDiscreteZoomPercent(ctx.zoom, 0.25)}
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
            <span
              data-layout-help="save-actions"
              className="inline-flex shrink-0 items-center gap-0.5"
            >
            {ctx.onSaveDraft ? (
              <TooltipWrapper
                text={
                  ctx.saveDraftLoading
                    ? 'Saving layout draft…'
                    : 'Save layout draft without deploying'
                }
              >
                <button
                  type="button"
                  onClick={ctx.onSaveDraft}
                  disabled={ctx.saveDraftDisabled || ctx.saveDraftLoading}
                  aria-label={
                    ctx.saveDraftLoading ? 'Saving layout draft' : 'Save layout draft'
                  }
                  className={cn(
                    'inline-flex shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white p-0 text-stone-800 hover:bg-stone-50 disabled:opacity-40',
                    toolbarIconButtonSize(compact)
                  )}
                >
                  <Save className="h-3.5 w-3.5" />
                </button>
              </TooltipWrapper>
            ) : null}
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
                    ctx.saveMarketLoading ? 'Saving market' : 'Save market and deploy'
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
            </span>
          </>
        )
      }
      if (sidebarLayout) {
        return (
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            <LayoutToolbarHelpTrigger compact={compact} />
            {ctx.onRequestAiLayoutFeedback ? (
              <button
                type="button"
                onClick={ctx.onRequestAiLayoutFeedback}
                disabled={
                  !ctx.canRequestAiLayoutFeedback || ctx.aiLayoutFeedbackLoading
                }
                className={cn(
                  'w-full rounded-md border border-violet-300 bg-violet-50 px-2 py-2 text-left text-[11px] font-semibold leading-snug text-violet-900 hover:bg-violet-100 disabled:opacity-50',
                  toolbarControlHeight(compact)
                )}
              >
                {ctx.aiLayoutFeedbackLoading
                  ? 'Analyzing layout…'
                  : '💡 Ask AI for Layout Feedback'}
              </button>
            ) : null}
            <div
              className="flex min-w-0 flex-row flex-wrap items-center gap-0.5"
              role="group"
              aria-label="Canvas view options"
            >
              {ctx.designerExitHref ? (
                <Link
                  href={ctx.designerExitHref}
                  prefetch
                  onClick={() => ctx.onDesignerExit?.()}
                  className="relative z-[10001] inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-forest px-2.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-forest/90 pointer-events-auto"
                  aria-label={ctx.designerExitLabel ?? 'Back to Event Setup'}
                >
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{ctx.designerExitLabel ?? 'Event setup'}</span>
                </Link>
              ) : null}
              {ctx.onPatronPathToggle ? (
                <CommandButton
                  onClick={ctx.onPatronPathToggle}
                  title={
                    ctx.patronPathEnabled
                      ? 'Hide patron flow aisles (6′ paths)'
                      : 'Toggle patron flow — show 6′ walking aisles'
                  }
                  active={ctx.patronPathEnabled}
                  className={
                    ctx.patronPathEnabled
                      ? 'bg-emerald-200 text-emerald-950 hover:bg-emerald-200'
                      : 'text-emerald-800 hover:bg-emerald-50'
                  }
                >
                  <Route className="h-3.5 w-3.5" />
                </CommandButton>
              ) : null}
              {ctx.onClearanceWarningsToggle ? (
                <CommandButton
                  onClick={ctx.onClearanceWarningsToggle}
                  title={
                    ctx.showClearanceWarnings
                      ? 'Hide booth clearance warnings (yellow/red aisles)'
                      : 'Show booth clearance warnings — yellow at 3′–4′ aisles, red below 3′'
                  }
                  active={ctx.showClearanceWarnings}
                  className={
                    ctx.showClearanceWarnings
                      ? 'bg-amber-200 text-amber-950 hover:bg-amber-200'
                      : 'text-amber-800 hover:bg-amber-50'
                  }
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </CommandButton>
              ) : null}
              {ctx.onShowLabelsChange ? (
                <CommandButton
                  onClick={() => ctx.onShowLabelsChange!(!ctx.showLabels)}
                  title={
                    ctx.showLabels
                      ? 'Hide architectural labels'
                      : 'Show architectural labels'
                  }
                  className={
                    ctx.showLabels
                      ? 'bg-sky-50 text-sky-900 hover:bg-sky-100'
                      : undefined
                  }
                >
                  {ctx.showLabels ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </CommandButton>
              ) : null}
              {ctx.onBoothMapLabelModeChange ? (
                <label
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 bg-white px-1.5 text-[10px] font-semibold text-stone-700',
                    toolbarControlHeight(compact)
                  )}
                >
                  <span className="hidden sm:inline">Map labels</span>
                  <select
                    className="w-[9.5rem] rounded-lg border-0 bg-transparent py-0 text-[10px] font-semibold text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    aria-label="Map labels — booth text overlay"
                    value={ctx.boothMapLabelMode ?? 'vendor'}
                    onChange={(e) =>
                      ctx.onBoothMapLabelModeChange!(
                        e.target.value as import('@/lib/coordinator/booth-map-label').BoothMapLabelMode
                      )
                    }
                  >
                    {BOOTH_MAP_LABEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {ctx.onLaunchDualScreen ? (
                <DualScreenLaunchButtons
                  onLaunchDualScreen={ctx.onLaunchDualScreen}
                  compact={compact}
                  variant="subtle"
                />
              ) : null}
              {ctx.onToggleCanvasFullscreen ? (
                <button
                  type="button"
                  onClick={() => ctx.onToggleCanvasFullscreen?.()}
                  title={
                    ctx.canvasFullscreen
                      ? 'Exit full screen (Esc)'
                      : 'Expand canvas to fill the monitor'
                  }
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 text-[11px] font-semibold text-stone-800 hover:bg-stone-50',
                    ctx.canvasFullscreen && 'border-stone-700 bg-stone-800 text-white hover:bg-stone-700',
                    toolbarControlHeight(compact)
                  )}
                >
                  {ctx.canvasFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : (
                    <Expand className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  {ctx.canvasFullscreen ? 'Exit full screen' : 'Full screen'}
                </button>
              ) : null}
              <span
                data-layout-help="save-actions"
                className="inline-flex shrink-0 items-center gap-0.5"
              >
              {ctx.onSaveDraft ? (
                <TooltipWrapper
                  text={
                    ctx.saveDraftLoading
                      ? 'Saving layout draft…'
                      : 'Save layout draft without deploying'
                  }
                >
                  <button
                    type="button"
                    onClick={ctx.onSaveDraft}
                    disabled={ctx.saveDraftDisabled || ctx.saveDraftLoading}
                    aria-label={
                      ctx.saveDraftLoading
                        ? 'Saving layout draft'
                        : 'Save layout draft'
                    }
                    className={cn(
                      'inline-flex shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white p-0 text-stone-800 hover:bg-stone-50 disabled:opacity-40',
                      toolbarIconButtonSize(compact)
                    )}
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </TooltipWrapper>
              ) : null}
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
              </span>
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
                className="inline-flex h-full flex-1 min-w-[3.25rem] items-center justify-center border-x border-stone-200 px-1.5 text-[11px] font-semibold tabular-nums text-stone-700 hover:bg-stone-100"
              >
                {formatDiscreteZoomPercent(ctx.zoom, 0.25)}
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
          </div>
        )
      }
      return (
        <>
          <LayoutToolbarHelpTrigger compact={compact} />
          <div className={toolbarDividerClass(compact)} aria-hidden />
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
          {ctx.designerExitHref ? (
            <Link
              href={ctx.designerExitHref}
              prefetch
              onClick={() => ctx.onDesignerExit?.()}
              className="relative z-[10001] inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-forest px-2.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-forest/90 pointer-events-auto"
              aria-label={ctx.designerExitLabel ?? 'Back to Event Setup'}
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="max-w-[9rem] truncate">
                {ctx.designerExitLabel ?? 'Event setup'}
              </span>
            </Link>
          ) : null}
          {ctx.onLaunchDualScreen ? (
            <DualScreenLaunchButtons
              onLaunchDualScreen={ctx.onLaunchDualScreen}
              compact={compact}
              variant="subtle"
            />
          ) : null}
          {ctx.onToggleCanvasFullscreen ? (
            <button
              type="button"
              onClick={() => ctx.onToggleCanvasFullscreen?.()}
              title={
                ctx.canvasFullscreen
                  ? 'Exit full screen (Esc)'
                  : 'Expand canvas to fill the monitor'
              }
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-md border border-stone-300 bg-white px-2 text-[11px] font-semibold text-stone-800 hover:bg-stone-50',
                ctx.canvasFullscreen && 'border-stone-700 bg-stone-800 text-white hover:bg-stone-700',
                toolbarControlHeight(compact)
              )}
            >
              {ctx.canvasFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <Expand className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              {ctx.canvasFullscreen ? 'Exit full screen' : 'Full screen'}
            </button>
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
              {formatDiscreteZoomPercent(ctx.zoom, 0.25)}
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
          <span
            data-layout-help="save-actions"
            className="inline-flex shrink-0 items-center gap-0.5"
          >
          {ctx.onSaveDraft ? (
            <TooltipWrapper
              text={
                ctx.saveDraftLoading
                  ? 'Saving layout draft…'
                  : 'Save layout draft without deploying'
              }
            >
              <button
                type="button"
                onClick={ctx.onSaveDraft}
                disabled={ctx.saveDraftDisabled || ctx.saveDraftLoading}
                aria-label={
                  ctx.saveDraftLoading ? 'Saving layout draft' : 'Save layout draft'
                }
                className={cn(
                  'inline-flex shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white p-0 text-stone-800 hover:bg-stone-50 disabled:opacity-40',
                  toolbarIconButtonSize(compact)
                )}
              >
                <Save className="h-3.5 w-3.5" />
              </button>
            </TooltipWrapper>
          ) : null}
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
          </span>
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
