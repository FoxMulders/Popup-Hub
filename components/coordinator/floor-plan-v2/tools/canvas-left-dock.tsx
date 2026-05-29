'use client'

import {
  ArrowUpRight,
  DoorOpen,
  Eye,
  EyeOff,
  Hand,
  Minus,
  MousePointer2,
  Plus,
  RectangleHorizontal,
  Siren,
  Square,
  SquareDashed,
  Tag,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DrawShape } from './types'
import type { CanvasToolHostProps } from './canvas-tool-types'

interface CanvasLeftDockProps extends CanvasToolHostProps {
  collapsed?: boolean
  className?: string
  showLabels?: boolean
  onShowLabelsChange?: (show: boolean) => void
}

interface DockButtonProps {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  variant?: 'default' | 'floor' | 'arch' | 'destructive'
}

function DockButton({
  active,
  onClick,
  disabled,
  title,
  label,
  icon: Icon,
  variant = 'default',
}: DockButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded-md px-1.5 py-2 text-[10px] font-semibold leading-none transition-colors',
        variant === 'destructive' &&
          'text-rose-700/90 hover:bg-rose-50 disabled:opacity-40',
        variant === 'floor' &&
          (active
            ? 'bg-amber-200 text-amber-950'
            : 'text-stone-700 hover:bg-amber-50'),
        variant === 'arch' &&
          (active
            ? 'bg-sky-200 text-sky-950'
            : 'text-stone-700 hover:bg-sky-50'),
        variant === 'default' &&
          (active
            ? 'bg-stone-900 text-white shadow-sm'
            : 'text-stone-700 hover:bg-stone-100'),
        disabled && 'opacity-40'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="max-w-[4.5rem] text-center">{label}</span>
    </button>
  )
}

function DockSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-1.5', className)}>
      <h3 className="px-1 text-[9px] font-bold uppercase tracking-[0.1em] text-stone-400">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-1">{children}</div>
    </section>
  )
}

const FLOOR_SHAPES: Array<{ id: DrawShape; label: string; icon: DockButtonProps['icon'] }> = [
  { id: 'booth', label: 'Booth', icon: Square },
  { id: 'aisle', label: 'Aisle', icon: ArrowUpRight },
  { id: 'label', label: 'Label', icon: Tag },
]

const ARCH_SHAPES: Array<{ id: DrawShape; label: string; icon: DockButtonProps['icon'] }> = [
  { id: 'wall', label: 'Wall', icon: Square },
  { id: 'open_wall', label: 'Open wall', icon: RectangleHorizontal },
  { id: 'door', label: 'Door', icon: DoorOpen },
  { id: 'emergency_exit', label: 'Exit', icon: Siren },
  { id: 'stage', label: 'Stage', icon: Square },
]

/**
 * Structural palette — view modifiers, floor assets, architectural
 * primitives, and an isolated destructive tray at the bottom.
 */
export function CanvasLeftDock({
  toolState,
  onToolChange,
  onDrawShapeChange,
  selectedCount,
  onDeleteSelected,
  onClearAll,
  onZoomIn,
  onZoomOut,
  onAddPerimeterWalls,
  showLabels = true,
  onShowLabelsChange,
  collapsed = false,
  className,
}: CanvasLeftDockProps) {
  if (collapsed) return null

  function activateDrawShape(shape: DrawShape) {
    onToolChange('draw')
    onDrawShapeChange(shape)
  }

  return (
    <aside
      className={cn(
        'flex w-[108px] shrink-0 flex-col rounded-lg border border-stone-200 bg-white shadow-sm',
        className
      )}
      aria-label="Structural tool palette"
    >
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-2">
        <DockSection title="View">
          <DockButton
            active={toolState.tool === 'select'}
            onClick={() => onToolChange('select')}
            title="Select (V)"
            label="Select"
            icon={MousePointer2}
          />
          <DockButton
            active={toolState.tool === 'hand'}
            onClick={() => onToolChange('hand')}
            title="Hand (H)"
            label="Hand"
            icon={Hand}
          />
          <DockButton
            onClick={onZoomOut}
            title="Zoom out"
            label="Zoom −"
            icon={Minus}
          />
          <DockButton
            onClick={onZoomIn}
            title="Zoom in"
            label="Zoom +"
            icon={Plus}
          />
          {onShowLabelsChange ? (
            <DockButton
              active={showLabels}
              onClick={() => onShowLabelsChange(!showLabels)}
              title={
                showLabels
                  ? 'Hide architectural labels'
                  : 'Show architectural labels'
              }
              label="Show Labels"
              icon={showLabels ? Eye : EyeOff}
            />
          ) : null}
        </DockSection>

        <div className="border-t border-stone-100" />

        <DockSection title="Floor">
          {FLOOR_SHAPES.map((shape) => (
            <DockButton
              key={shape.id}
              active={toolState.tool === 'draw' && toolState.drawShape === shape.id}
              onClick={() => activateDrawShape(shape.id)}
              title={shape.label}
              label={shape.label}
              icon={shape.icon}
              variant="floor"
            />
          ))}
        </DockSection>

        <div className="border-t border-stone-100" />

        <DockSection title="Architecture">
          {ARCH_SHAPES.map((shape) => (
            <DockButton
              key={shape.id}
              active={toolState.tool === 'draw' && toolState.drawShape === shape.id}
              onClick={() => activateDrawShape(shape.id)}
              title={shape.label}
              label={shape.label}
              icon={shape.icon}
              variant="arch"
            />
          ))}
          {onAddPerimeterWalls && (
            <DockButton
              onClick={onAddPerimeterWalls}
              title="Seal the active room with four locked perimeter walls"
              label="Add perimeter"
              icon={SquareDashed}
              variant="arch"
            />
          )}
        </DockSection>
      </div>

      <div className="mt-auto border-t border-rose-100 bg-rose-50/40 p-2">
        <h3 className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-[0.1em] text-rose-400">
          Destructive
        </h3>
        <div className="grid grid-cols-1 gap-1">
          <DockButton
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            title={`Delete ${selectedCount} selected`}
            label="Delete"
            icon={Trash2}
            variant="destructive"
          />
          <DockButton
            onClick={onClearAll}
            title="Clear all objects"
            label="Clear all"
            icon={Trash2}
            variant="destructive"
          />
        </div>
      </div>
    </aside>
  )
}
