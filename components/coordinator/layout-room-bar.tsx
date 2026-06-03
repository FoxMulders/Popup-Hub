'use client'

import { useEffect, useRef, useState } from 'react'
import type { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import {
  LAYOUT_ROOM_PRESETS,
  type LayoutRoomPresetId,
} from '@/lib/booth-planner/layout-room-presets'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Check, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LayoutRoomBarProps {
  rooms: LayoutRoom[]
  activeRoomId: string
  onSelectRoom: (roomId: string) => void
  /**
   * Add a new room. The optional `presetId` forwards a structural
   * preset (kitchen, outdoor stage, annex). When omitted the room
   * bar falls back to the legacy `blank` preset for the existing
   * "+ Add room" button affordance.
   */
  onAddRoom: (presetId?: LayoutRoomPresetId) => void
  onRenameRoom: (roomId: string, name: string) => void
  onDeleteRoom: (roomId: string) => void
  /** Vertical room list for the floor-plan sidebar. */
  compact?: boolean
  /**
   * Live dimensions for the highlighted room — updates during canvas
   * resize and reads from the unified doc room frame.
   */
  highlightedRoomMetrics?: {
    name: string
    widthFt: number
    lengthFt: number
  } | null
  /**
   * Slim toolbar mode: render as a thin horizontal ribbon designed
   * to stack directly under the canvas command bar instead of as a
   * full `market-panel` card. Drops the panel chrome, shrinks the
   * "Rooms / zones" caption, and reduces vertical padding so the
   * bar sits cleanly between the primary toolbar and the canvas
   * grid without eating workspace height.
   */
  slim?: boolean
  /**
   * Inline mode: no outer panel chrome — tabs and Add room live
   * inside the primary CanvasCommandBar row (no secondary ribbon).
   */
  embedded?: boolean
}

export function LayoutRoomBar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
  compact = false,
  highlightedRoomMetrics = null,
  slim = false,
  embedded = false,
}: LayoutRoomBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  /**
   * Preset menu visibility. We show the list of structural presets
   * (Kitchen / Outdoor Stage / Annex) below the "Add room" button as
   * a small popover so the existing one-click flow stays identical
   * for users who just want a blank room.
   */
  const [presetMenuOpen, setPresetMenuOpen] = useState(false)
  const presetMenuRef = useRef<HTMLDivElement | null>(null)

  // Close the preset menu on outside-click / Escape so it behaves like
  // a real popover, not a sticky dropdown.
  useEffect(() => {
    if (!presetMenuOpen) return
    function handleDown(e: MouseEvent) {
      const root = presetMenuRef.current
      if (root && !root.contains(e.target as Node)) {
        setPresetMenuOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPresetMenuOpen(false)
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [presetMenuOpen])

  function startRename(room: LayoutRoom) {
    setEditingId(room.id)
    setDraftName(room.name)
  }

  function commitRename(roomId: string) {
    const trimmed = draftName.trim()
    if (trimmed) onRenameRoom(roomId, trimmed)
    setEditingId(null)
  }

  const inlineToolbar = slim || embedded

  return (
    <div
      className={cn(
        embedded
          ? 'flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1'
          : slim
            ? 'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 shadow-sm'
            : 'market-panel p-3 space-y-2'
      )}
      role={embedded ? 'group' : 'toolbar'}
      aria-label="Rooms and zones"
    >
      {!embedded ? (
      <div
        className={cn(
          slim
            ? 'flex shrink-0 items-center gap-2'
            : 'flex items-center justify-between gap-2'
        )}
      >
        <p
          className={cn(
            slim
              ? 'text-[10px] font-heading font-semibold text-muted-foreground uppercase tracking-wide'
              : 'text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide'
          )}
        >
          Rooms / zones
        </p>
        {highlightedRoomMetrics ? (
          <span
            className={cn(
              'rounded-md border border-stone-200 bg-stone-50 font-semibold tabular-nums text-stone-700',
              slim ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'
            )}
            title="Physical dimensions of the highlighted room"
          >
            {highlightedRoomMetrics.name}: {Math.round(highlightedRoomMetrics.widthFt)}'
            {' × '}
            {Math.round(highlightedRoomMetrics.lengthFt)}'
          </span>
        ) : null}
        <div className="relative" ref={presetMenuRef}>
          <div
            className={cn(
              'flex items-stretch overflow-hidden rounded-md border-2 border-stone-200',
              slim ? 'border' : 'border-2'
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'gap-1 rounded-none border-0',
                slim ? 'h-8 min-h-0 px-2 text-xs' : 'min-h-11'
              )}
              onClick={() => onAddRoom()}
            >
              <Plus className="h-3.5 w-3.5" />
              Add room
            </Button>
            <button
              type="button"
              aria-label="Choose room preset"
              aria-expanded={presetMenuOpen}
              aria-haspopup="menu"
              onClick={() => setPresetMenuOpen((v) => !v)}
              className={cn(
                'flex items-center justify-center border-l-2 border-stone-200 px-2 text-stone-600 hover:bg-canvas',
                slim ? 'h-8 min-h-0' : 'min-h-11'
              )}
            >
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  presetMenuOpen ? 'rotate-180' : ''
                )}
              />
            </button>
          </div>
          {presetMenuOpen ? (
            <div
              role="menu"
              aria-label="Add room from preset"
              className="absolute right-0 z-20 mt-1 w-64 rounded-lg border-2 border-stone-200 bg-card p-1 shadow-[var(--shadow-market)]"
            >
              {LAYOUT_ROOM_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPresetMenuOpen(false)
                    onAddRoom(preset.id)
                  }}
                  className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-canvas"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {preset.name}
                  </span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      ) : (
        <>
          {highlightedRoomMetrics ? (
            <span
              className="shrink-0 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-semibold tabular-nums text-stone-700"
              title="Physical dimensions of the highlighted room"
            >
              {highlightedRoomMetrics.name}: {Math.round(highlightedRoomMetrics.widthFt)}'
              {' × '}
              {Math.round(highlightedRoomMetrics.lengthFt)}'
            </span>
          ) : null}
          <div className="relative shrink-0" ref={presetMenuRef}>
          <div className="flex items-stretch overflow-hidden rounded-md border border-stone-200">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 min-h-0 gap-1 rounded-none border-0 px-2 text-xs"
              onClick={() => onAddRoom()}
            >
              <Plus className="h-3.5 w-3.5" />
              Add room
            </Button>
            <button
              type="button"
              aria-label="Choose room preset"
              aria-expanded={presetMenuOpen}
              aria-haspopup="menu"
              onClick={() => setPresetMenuOpen((v) => !v)}
              className="flex h-8 min-h-0 items-center justify-center border-l border-stone-200 px-2 text-stone-600 hover:bg-canvas"
            >
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  presetMenuOpen ? 'rotate-180' : ''
                )}
              />
            </button>
          </div>
          {presetMenuOpen ? (
            <div
              role="menu"
              aria-label="Add room from preset"
              className="absolute left-0 z-20 mt-1 w-64 rounded-lg border border-stone-200 bg-card p-1 shadow-[var(--shadow-market)]"
            >
              {LAYOUT_ROOM_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPresetMenuOpen(false)
                    onAddRoom(preset.id)
                  }}
                  className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-canvas"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {preset.name}
                  </span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        </>
      )}
      <div
        className={cn(
          'flex gap-2 -mx-1 px-1',
          embedded ? 'min-w-0 flex-1 items-center overflow-x-auto pb-0' : slim ? 'min-w-0 flex-1 items-center pb-0' : 'pb-1',
          compact
            ? 'flex-col items-stretch'
            : slim || embedded
              ? 'overflow-x-auto'
              : 'scroll-touch-x items-center'
        )}
      >
        {rooms.map((room) => {
          const isActive = room.id === activeRoomId
          const isEditing = editingId === room.id

          if (isEditing) {
            return (
              <div
                key={room.id}
                className="flex shrink-0 items-center gap-1 rounded-xl border-2 border-harvest-400 bg-harvest-50 px-2 py-1"
              >
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(room.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="w-32 min-h-11 rounded-lg border-2 border-stone-200 bg-card px-2 text-base"
                  autoFocus
                />
                <button
                  type="button"
                  className="touch-target text-sage-700 hover:bg-sage-100 rounded-lg"
                  onClick={() => commitRename(room.id)}
                  aria-label="Save name"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="touch-target text-muted-foreground hover:bg-canvas rounded-lg"
                  onClick={() => setEditingId(null)}
                  aria-label="Cancel rename"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          }

          return (
            <div
              key={room.id}
              className={cn(
                'flex items-center overflow-hidden transition-all duration-200',
                inlineToolbar ? 'rounded-md border' : 'rounded-xl border-2',
                compact ? 'w-full shrink-0' : 'shrink-0',
                isActive
                  ? inlineToolbar
                    ? 'border-harvest-500'
                    : 'border-harvest-500 shadow-[var(--shadow-market)]'
                  : 'border-stone-200'
              )}
            >
              <button
                type="button"
                onClick={() => onSelectRoom(room.id)}
                className={cn(
                  'font-medium transition-all duration-200 active:translate-y-0.5',
                  inlineToolbar
                    ? 'h-8 px-3 text-xs'
                    : 'min-h-11 px-4 text-sm',
                  isActive
                    ? 'bg-forest text-primary-foreground'
                    : 'bg-card text-foreground hover:bg-canvas'
                )}
              >
                {room.name}
              </button>
              {isActive && (
                <>
                  <button
                    type="button"
                    title="Rename room"
                    className={cn(
                      'border-l-2 border-stone-200 text-muted-foreground hover:bg-canvas',
                      inlineToolbar
                        ? 'flex h-8 w-7 items-center justify-center border-l'
                        : 'touch-target'
                    )}
                    onClick={() => startRename(room)}
                  >
                    <Pencil className={inlineToolbar ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                  </button>
                  <button
                    type="button"
                    title="Delete room"
                    className={cn(
                      'border-l-2 border-stone-200 text-terracotta-600 hover:bg-terracotta-50',
                      inlineToolbar
                        ? 'flex h-8 w-7 items-center justify-center border-l'
                        : 'touch-target'
                    )}
                    onClick={() => onDeleteRoom(room.id)}
                  >
                    <Trash2 className={inlineToolbar ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
