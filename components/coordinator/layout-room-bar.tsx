'use client'

import { useState } from 'react'
import type { LayoutRoom } from '@/lib/booth-planner/layout-rooms'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LayoutRoomBarProps {
  rooms: LayoutRoom[]
  activeRoomId: string
  onSelectRoom: (roomId: string) => void
  onAddRoom: () => void
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
        <Button type="button" variant="outline" size="sm" className="gap-1 min-h-11" onClick={onAddRoom}>
          <Plus className="h-3.5 w-3.5" />
          Add room
        </Button>
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
