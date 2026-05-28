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
}

export function LayoutRoomBar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
  compact = false,
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

  return (
    <div className="market-panel p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">
          Rooms / zones
        </p>
        <div className="relative" ref={presetMenuRef}>
          <div className="flex items-stretch overflow-hidden rounded-md border-2 border-stone-200">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 min-h-11 rounded-none border-0"
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
              className="flex min-h-11 items-center justify-center border-l-2 border-stone-200 px-2 text-stone-600 hover:bg-canvas"
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
      <div
        className={cn(
          'flex gap-2 pb-1 -mx-1 px-1',
          compact ? 'flex-col items-stretch' : 'scroll-touch-x items-center'
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
                'flex items-center rounded-xl border-2 overflow-hidden transition-all duration-200',
                compact ? 'w-full shrink-0' : 'shrink-0',
                isActive ? 'border-harvest-500 shadow-[var(--shadow-market)]' : 'border-stone-200'
              )}
            >
              <button
                type="button"
                onClick={() => onSelectRoom(room.id)}
                className={cn(
                  'min-h-11 px-4 text-sm font-medium transition-all duration-200 active:translate-y-0.5',
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
                    className="touch-target border-l-2 border-stone-200 text-muted-foreground hover:bg-canvas"
                    onClick={() => startRename(room)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {rooms.length > 1 && (
                    <button
                      type="button"
                      title="Delete room"
                      className="touch-target border-l-2 border-stone-200 text-terracotta-600 hover:bg-terracotta-50"
                      onClick={() => onDeleteRoom(room.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
