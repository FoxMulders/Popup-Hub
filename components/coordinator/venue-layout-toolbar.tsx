'use client'

import {
  DoorOpen,
  ArrowDownUp,
  LogOut,
  Circle,
  Eraser,
  LayoutGrid,
  Lock,
} from 'lucide-react'
import { VENUE_ELEMENT_TOOLS } from '@/lib/booth-planner/venue-elements'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import {
  PRIMARY_LAYOUT_TOOLS,
  type LayoutTool,
} from '@/lib/booth-planner/layout-tool-shortcuts'
import { cn } from '@/lib/utils'

export type { LayoutTool } from '@/lib/booth-planner/layout-tool-shortcuts'

const PRIMARY_ICONS: Partial<Record<LayoutTool, React.ComponentType<{ className?: string }>>> = {
  vendor: LayoutGrid,
  column: Circle,
  aisle: ArrowDownUp,
  entrance: DoorOpen,
  exit: LogOut,
  lock: Lock,
  eraser: Eraser,
}

interface VenueLayoutToolbarProps {
  activeTool: LayoutTool
  lockedCount: number
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  onClearCanvas?: () => void
  onToolChange: (tool: LayoutTool) => void
  onLockAll: () => void
  onUnlockAll: () => void
  /** Minimal sidebar hint — fixture selection lives in VenueFixturesCatalog. */
  compact?: boolean
  /** Single-row icon dock above the canvas. */
  horizontal?: boolean
}

export function VenueLayoutToolbar({
  activeTool,
  lockedCount,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onClearCanvas,
  onToolChange,
  onLockAll,
  onUnlockAll,
  compact = false,
  horizontal = false,
}: VenueLayoutToolbarProps) {
  if (compact) {
    return (
      <aside className="market-panel p-2.5 space-y-2" aria-label="Layout tool palette">
        <TooltipWrapper text="Press a letter key to switch tools. Ctrl+Z undo · Ctrl+Shift+Z redo.">
          <p className="text-[10px] font-heading font-semibold text-muted-foreground uppercase tracking-wide cursor-default">
            Shortcuts: V W A E X L R
          </p>
        </TooltipWrapper>
        <div className="flex flex-col gap-2 border-t border-stone-200 pt-2">
          <TooltipWrapper text="Lock every fixture so template and painted items cannot be erased">
            <button
              type="button"
              onClick={onLockAll}
              className="min-h-9 px-1 text-left text-[10px] font-black text-black hover:underline underline-offset-2"
            >
              Lock all
            </button>
          </TooltipWrapper>
          <TooltipWrapper text="Unlock all fixtures for editing — use with care on template shells">
            <button
              type="button"
              onClick={onUnlockAll}
              className="min-h-9 px-1 text-left text-[10px] font-black text-black hover:underline underline-offset-2"
            >
              Unlock all
            </button>
          </TooltipWrapper>
        </div>
        {activeTool === 'lock' && lockedCount > 0 ? (
          <p className="text-[10px] text-foreground tabular-nums">{lockedCount} locked</p>
        ) : null}
      </aside>
    )
  }

  if (horizontal) {
    return (
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Layout tools">
        {(canUndo || canRedo || onClearCanvas) && (
          <>
            <ToolbarAction
              label="Undo"
              description="Reverse the last canvas change"
              shortcut="Ctrl+Z"
              disabled={!canUndo}
              onClick={() => onUndo?.()}
            >
              Undo
            </ToolbarAction>
            <ToolbarAction
              label="Redo"
              description="Reapply an undone change"
              shortcut="Ctrl+Shift+Z"
              disabled={!canRedo}
              onClick={() => onRedo?.()}
            >
              Redo
            </ToolbarAction>
            {onClearCanvas ? (
              <ToolbarAction label="Clear Canvas" description="Reset vendors and painted items" shortcut="" onClick={onClearCanvas}>
                Clear
              </ToolbarAction>
            ) : null}
            <span className="mx-0.5 h-5 w-px bg-stone-300" aria-hidden />
          </>
        )}
        {PRIMARY_LAYOUT_TOOLS.map((meta) => {
          const Icon = PRIMARY_ICONS[meta.tool]
          return (
            <ToolButton
              key={meta.tool}
              tool={meta.tool}
              label={meta.label}
              description={meta.description}
              sizeProfile={meta.sizeProfile}
              shortcut={meta.shortcut}
              active={activeTool === meta.tool}
              onClick={() => onToolChange(meta.tool)}
              icon={Icon ? <Icon className="h-3.5 w-3.5" /> : undefined}
              compact
            />
          )
        })}
        {VENUE_ELEMENT_TOOLS.filter(
          (t) => t.type !== 'eraser' && !PRIMARY_LAYOUT_TOOLS.some((p) => p.tool === t.type)
        ).map((t) => (
          <ToolButton
            key={t.type}
            tool={t.type as LayoutTool}
            label={t.label}
            description={t.description}
            sizeProfile="1 × 1 cell default"
            shortcut=""
            active={activeTool === t.type}
            onClick={() => onToolChange(t.type as LayoutTool)}
            compact
          />
        ))}
      </div>
    )
  }

  return (
    <aside className="market-panel p-3 space-y-2" aria-label="Layout tool palette">
      <TooltipWrapper text="Press a letter key to switch tools. Ctrl+Z undo · Ctrl+Shift+Z redo.">
        <p className="text-[10px] font-heading font-semibold text-muted-foreground uppercase tracking-wide cursor-default">
          Venue fixtures
        </p>
      </TooltipWrapper>

      {(canUndo || canRedo || onClearCanvas) && (
        <div className="flex flex-wrap gap-1.5">
          <ToolbarAction
            label="Undo"
            description="Reverse the last canvas change"
            shortcut="Ctrl+Z"
            disabled={!canUndo}
            onClick={() => onUndo?.()}
          >
            Undo
          </ToolbarAction>
          <ToolbarAction
            label="Redo"
            description="Reapply an undone change"
            shortcut="Ctrl+Shift+Z"
            disabled={!canRedo}
            onClick={() => onRedo?.()}
          >
            Redo
          </ToolbarAction>
          {onClearCanvas ? (
            <ToolbarAction
              label="Clear Canvas"
              description="Remove vendors and painted fixtures; locked template shell stays"
              shortcut=""
              onClick={onClearCanvas}
            >
              Clear
            </ToolbarAction>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Primary layout tools">
        {PRIMARY_LAYOUT_TOOLS.map((meta) => {
          const Icon = PRIMARY_ICONS[meta.tool]
          return (
            <ToolButton
              key={meta.tool}
              tool={meta.tool}
              label={meta.label}
              description={meta.description}
              sizeProfile={meta.sizeProfile}
              shortcut={meta.shortcut}
              active={activeTool === meta.tool}
              onClick={() => onToolChange(meta.tool)}
              icon={Icon ? <Icon className="h-3.5 w-3.5" /> : undefined}
            />
          )
        })}
        {VENUE_ELEMENT_TOOLS.filter(
          (t) => t.type !== 'eraser' && !PRIMARY_LAYOUT_TOOLS.some((p) => p.tool === t.type)
        ).map((t) => (
          <ToolButton
            key={t.type}
            tool={t.type as LayoutTool}
            label={t.label}
            description={t.description}
            sizeProfile="1 × 1 cell default"
            shortcut=""
            active={activeTool === t.type}
            onClick={() => onToolChange(t.type as LayoutTool)}
          />
        ))}
      </div>

      {activeTool === 'lock' && lockedCount > 0 ? (
        <p className="text-[10px] text-foreground tabular-nums">{lockedCount} locked</p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-stone-200 pt-1">
        <TooltipWrapper text="Lock every fixture so template and painted items cannot be erased">
          <button
            type="button"
            onClick={onLockAll}
            className="min-h-9 px-1 text-left text-[10px] font-black text-black hover:underline underline-offset-2"
          >
            Lock all
          </button>
        </TooltipWrapper>
        <TooltipWrapper text="Unlock all fixtures for editing — use with care on template shells">
          <button
            type="button"
            onClick={onUnlockAll}
            className="min-h-9 px-1 text-left text-[10px] font-black text-black hover:underline underline-offset-2"
          >
            Unlock all
          </button>
        </TooltipWrapper>
      </div>
    </aside>
  )
}

function ToolButton({
  tool,
  label,
  description,
  sizeProfile,
  shortcut,
  active,
  onClick,
  icon,
  compact = false,
}: {
  tool: LayoutTool
  label: string
  description: string
  sizeProfile: string
  shortcut: string
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  compact?: boolean
}) {
  const tip = `${label} — ${description}${shortcut ? ` · ${shortcut}` : ''} · ${sizeProfile}`
  return (
    <TooltipWrapper text={tip}>
      <button
        type="button"
        aria-pressed={active}
        aria-keyshortcuts={shortcut || undefined}
        aria-label={label}
        onClick={onClick}
        className={cn(
          'relative inline-flex items-center gap-1.5 rounded-none border-2 border-black text-xs font-black text-black transition-all duration-200',
          compact ? 'w-full justify-start px-2 py-1.5 min-h-9' : 'px-2.5 py-2 min-h-11 min-w-11',
          active
            ? 'bg-zinc-900 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            : 'bg-white hover:bg-zinc-100 active:translate-y-0.5'
        )}
      >
        {icon}
        <span className={cn(compact ? 'truncate' : 'hidden sm:inline max-w-[4.5rem] truncate')}>
          {compact ? label : label.split(' ')[0]}
        </span>
        {shortcut ? (
          <kbd
            className={cn(
              'absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-none border-2 border-black px-1 text-[10px] font-black',
              active ? 'bg-white text-black' : 'bg-zinc-900 text-white'
            )}
          >
            {shortcut}
          </kbd>
        ) : null}
      </button>
    </TooltipWrapper>
  )
}

function ToolbarAction({
  label,
  description,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string
  description: string
  shortcut: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const tip = `${label} — ${description}${shortcut ? ` · ${shortcut}` : ''}`
  return (
    <TooltipWrapper text={tip}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="min-h-9 w-full rounded-none border-2 border-black bg-white px-2 text-xs font-black text-black disabled:opacity-40 hover:bg-zinc-100 active:translate-y-0.5"
      >
        {children}
      </button>
    </TooltipWrapper>
  )
}
